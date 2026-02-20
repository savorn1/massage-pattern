import { Injectable, Logger } from '@nestjs/common';

export type CircuitState = 'closed' | 'open' | 'half-open';
export type CallOutcome = 'success' | 'failure' | 'rejected' | 'fallback';

export interface CallRecord {
  id: string;
  timestamp: string;
  outcome: CallOutcome;
  durationMs: number;
  state: CircuitState; // state at the time of the call
  error?: string;
  response?: unknown;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;   // how many failures to trip to OPEN
  windowMs: number;           // time window to count failures in (ms)
  timeoutMs: number;          // how long to stay OPEN before trying HALF-OPEN
  successThreshold: number;   // successes in HALF-OPEN needed to close (we use 1 for simplicity)
  serviceLatencyMs: number;   // simulated downstream call delay
  fallbackEnabled: boolean;   // return fallback response when OPEN
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  failures: number;
  config: CircuitBreakerConfig;
  openedAt?: string;
  halfOpenAt?: string;
  lastStateChange: string;
  serviceDown: boolean;
  timeUntilHalfOpenMs?: number;
  // Stats
  totalCalls: number;
  totalSuccess: number;
  totalFailure: number;
  totalRejected: number;
  totalFallback: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  // Circuit state
  private state: CircuitState = 'closed';
  private failures = 0;
  private openedAt?: number;
  private halfOpenAt?: number;
  private lastStateChange = new Date().toISOString();

  // Simulated downstream service
  private serviceDown = false;

  // Config (can be changed at runtime)
  private config: CircuitBreakerConfig = {
    failureThreshold: 3,
    windowMs: 10_000,
    timeoutMs: 15_000,
    successThreshold: 1,
    serviceLatencyMs: 300,
    fallbackEnabled: true,
  };

  // Call tracking
  private callLog: CallRecord[] = [];
  private stats = {
    totalCalls: 0,
    totalSuccess: 0,
    totalFailure: 0,
    totalRejected: 0,
    totalFallback: 0,
  };

  // Failure timestamps for sliding window
  private failureTimestamps: number[] = [];

  // ─── Core Call Method ────────────────────────────────────────────────────

  async call(requestLabel?: string): Promise<CallRecord> {
    const callId = `CALL-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const start = Date.now();
    const stateAtCall = this.state;

    this.stats.totalCalls++;

    // Check state transitions first
    this.checkStateTransition();

    // OPEN: reject immediately (fast fail)
    if (this.state === 'open') {
      this.stats.totalRejected++;

      if (this.config.fallbackEnabled) {
        this.stats.totalFallback++;
        const record = this.recordCall(callId, 'fallback', Date.now() - start, 'open', {
          message: 'Circuit OPEN — serving fallback response',
          data: { cached: true, label: requestLabel || 'payment' },
        });
        this.logger.warn(`[CB] OPEN — fallback served for ${callId}`);
        return record;
      }

      const record = this.recordCall(callId, 'rejected', Date.now() - start, 'open', undefined,
        'Circuit breaker OPEN — request rejected',
      );
      this.logger.warn(`[CB] OPEN — rejected ${callId}`);
      return record;
    }

    // HALF-OPEN: one trial call
    if (this.state === 'half-open') {
      this.logger.log(`[CB] HALF-OPEN — trial call ${callId}`);
    }

    // CLOSED or HALF-OPEN: make the actual call
    try {
      await this.delay(this.config.serviceLatencyMs);

      if (this.serviceDown) {
        throw new Error('Downstream service unavailable (simulated)');
      }

      // Success
      this.onSuccess();
      this.stats.totalSuccess++;

      const record = this.recordCall(callId, 'success', Date.now() - start, stateAtCall, {
        message: 'Payment processed successfully',
        transactionId: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        label: requestLabel || 'payment',
      });
      this.logger.log(`[CB] SUCCESS — ${callId} (${Date.now() - start}ms)`);
      return record;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.onFailure();
      this.stats.totalFailure++;

      const record = this.recordCall(callId, 'failure', Date.now() - start, stateAtCall, undefined, message);
      this.logger.warn(`[CB] FAILURE — ${callId}: ${message}`);
      return record;
    }
  }

  async callBatch(count: number): Promise<CallRecord[]> {
    const results: CallRecord[] = [];
    for (let i = 0; i < count; i++) {
      const result = await this.call(`request-${i + 1}`);
      results.push(result);
      // Small delay between batch calls to show progression
      await this.delay(80);
    }
    return results;
  }

  // ─── State Machine ───────────────────────────────────────────────────────

  private checkStateTransition(): void {
    if (this.state === 'open' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.config.timeoutMs) {
        this.transitionTo('half-open');
        this.halfOpenAt = Date.now();
      }
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      // Trial succeeded → close circuit
      this.transitionTo('closed');
      this.failures = 0;
      this.failureTimestamps = [];
    } else if (this.state === 'closed') {
      // Normal success — do nothing special
    }
  }

  private onFailure(): void {
    const now = Date.now();

    if (this.state === 'half-open') {
      // Trial failed → reopen
      this.transitionTo('open');
      this.openedAt = now;
      return;
    }

    // Sliding window: remove timestamps older than windowMs
    this.failureTimestamps = this.failureTimestamps.filter(
      (t) => now - t < this.config.windowMs,
    );
    this.failureTimestamps.push(now);
    this.failures = this.failureTimestamps.length;

    if (this.failures >= this.config.failureThreshold) {
      this.transitionTo('open');
      this.openedAt = now;
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    this.logger.log(`[CB] State: ${this.state.toUpperCase()} → ${newState.toUpperCase()}`);
    this.state = newState;
    this.lastStateChange = new Date().toISOString();

    if (newState === 'closed') {
      this.openedAt = undefined;
      this.halfOpenAt = undefined;
      this.failures = 0;
      this.failureTimestamps = [];
    }
    if (newState === 'open') {
      this.halfOpenAt = undefined;
    }
  }

  // ─── Service Simulation ──────────────────────────────────────────────────

  setServiceDown(down: boolean): void {
    this.serviceDown = down;
    this.logger.log(`[CB] Downstream service: ${down ? 'DOWN' : 'UP'}`);
  }

  isServiceDown(): boolean {
    return this.serviceDown;
  }

  // Manual state override (for demo purposes)
  resetCircuit(): void {
    this.transitionTo('closed');
    this.failures = 0;
    this.failureTimestamps = [];
    this.openedAt = undefined;
    this.halfOpenAt = undefined;
    this.logger.log('[CB] Circuit manually reset to CLOSED');
  }

  tripCircuit(): void {
    this.transitionTo('open');
    this.openedAt = Date.now();
    this.failures = this.config.failureThreshold;
    this.logger.log('[CB] Circuit manually tripped to OPEN');
  }

  // ─── Config ──────────────────────────────────────────────────────────────

  updateConfig(partial: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...partial };
    this.logger.log(`[CB] Config updated: ${JSON.stringify(partial)}`);
  }

  // ─── Status & Queries ────────────────────────────────────────────────────

  getStatus(): CircuitBreakerStatus {
    this.checkStateTransition(); // refresh state before returning

    const timeUntilHalfOpenMs =
      this.state === 'open' && this.openedAt
        ? Math.max(0, this.config.timeoutMs - (Date.now() - this.openedAt))
        : undefined;

    return {
      state: this.state,
      failures: this.failureTimestamps.filter(
        (t) => Date.now() - t < this.config.windowMs,
      ).length,
      config: this.config,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : undefined,
      halfOpenAt: this.halfOpenAt ? new Date(this.halfOpenAt).toISOString() : undefined,
      lastStateChange: this.lastStateChange,
      serviceDown: this.serviceDown,
      timeUntilHalfOpenMs,
      ...this.stats,
    };
  }

  getCallLog(): CallRecord[] {
    return this.callLog;
  }

  clearLog(): void {
    this.callLog = [];
    this.stats = { totalCalls: 0, totalSuccess: 0, totalFailure: 0, totalRejected: 0, totalFallback: 0 };
    this.resetCircuit();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private recordCall(
    id: string,
    outcome: CallOutcome,
    durationMs: number,
    state: CircuitState,
    response?: unknown,
    error?: string,
  ): CallRecord {
    const record: CallRecord = {
      id,
      timestamp: new Date().toISOString(),
      outcome,
      durationMs,
      state,
      response,
      error,
    };
    this.callLog.unshift(record);
    if (this.callLog.length > 100) {
      this.callLog = this.callLog.slice(0, 100);
    }
    return record;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
