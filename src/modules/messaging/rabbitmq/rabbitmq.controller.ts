import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RabbitmqService } from './rabbitmq.service';
import { SagaOrchestratorService } from './saga-orchestrator.service';
import { DlqService, DlqConfig } from './dlq.service';
import { OutboxService } from './outbox.service';
import { CircuitBreakerService, CircuitBreakerConfig } from './circuit-breaker.service';
import { BackpressureService, BackpressureConfig } from './backpressure.service';

@ApiTags('RabbitMQ')
@Controller('rabbitmq')
export class RabbitmqController {
  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly sagaService: SagaOrchestratorService,
    private readonly dlqService: DlqService,
    private readonly outboxService: OutboxService,
    private readonly cbService: CircuitBreakerService,
    private readonly bpService: BackpressureService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get RabbitMQ info and status' })
  getInfo() {
    return {
      pattern: 'RabbitMQ',
      description: 'Background job processing with worker pattern',
      status: this.rabbitmqService.isConnected() ? 'connected' : 'disconnected',
      activeConsumers: this.rabbitmqService.getActiveConsumers(),
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get connection status' })
  getStatus() {
    return {
      connected: this.rabbitmqService.isConnected(),
      activeConsumers: this.rabbitmqService.getActiveConsumers(),
    };
  }

  // --- Direct Queue ---

  @Post('send')
  @ApiOperation({ summary: 'Send a message directly to a queue' })
  async send(@Body() body: { queue: string; message: string }) {
    await this.rabbitmqService.sendToQueue(body.queue, body.message);
    return { success: true, queue: body.queue, message: body.message };
  }

  @Post('send-batch')
  @ApiOperation({ summary: 'Send multiple messages to a queue' })
  async sendBatch(@Body() body: { queue: string; messages: string[] }) {
    for (const msg of body.messages) {
      await this.rabbitmqService.sendToQueue(body.queue, msg);
    }
    return { success: true, queue: body.queue, count: body.messages.length };
  }

  // --- Exchange ---

  @Post('publish')
  @ApiOperation({ summary: 'Publish to an exchange with routing key' })
  async publish(
    @Body() body: {
      exchange: string;
      routingKey: string;
      message: string;
      type?: 'direct' | 'fanout' | 'topic';
    },
  ) {
    await this.rabbitmqService.publishToExchange(
      body.exchange,
      body.routingKey,
      body.message,
      body.type || 'topic',
    );
    return {
      success: true,
      exchange: body.exchange,
      routingKey: body.routingKey,
      type: body.type || 'topic',
    };
  }

  @Post('bind')
  @ApiOperation({ summary: 'Bind a queue to an exchange' })
  async bind(
    @Body() body: {
      queue: string;
      exchange: string;
      routingKey: string;
      exchangeType?: 'direct' | 'fanout' | 'topic';
    },
  ) {
    await this.rabbitmqService.bindQueueToExchange(
      body.queue,
      body.exchange,
      body.routingKey,
      body.exchangeType || 'topic',
    );
    return {
      success: true,
      queue: body.queue,
      exchange: body.exchange,
      routingKey: body.routingKey,
    };
  }

  // --- Consumer ---

  @Post('consume')
  @ApiOperation({ summary: 'Start consuming from a queue' })
  async startConsumer(@Body() body: { queue: string }) {
    await this.rabbitmqService.consume(body.queue, (msg) => {
      // Messages are tracked in the service
    });
    return { success: true, queue: body.queue, status: 'consuming' };
  }

  @Post('consume/cancel')
  @ApiOperation({ summary: 'Cancel a consumer' })
  async cancelConsumer(@Body() body: { queue: string }) {
    await this.rabbitmqService.cancelConsumer(body.queue);
    return { success: true, queue: body.queue, status: 'cancelled' };
  }

  // --- Queue Management ---

  @Get('queue/:name/stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  async getQueueStats(@Param('name') name: string) {
    return this.rabbitmqService.getQueueStats(name);
  }

  @Post('queue/:name/purge')
  @ApiOperation({ summary: 'Purge all messages from a queue' })
  async purgeQueue(@Param('name') name: string) {
    const purged = await this.rabbitmqService.purgeQueue(name);
    return { success: true, queue: name, purgedCount: purged };
  }

  @Delete('queue/:name')
  @ApiOperation({ summary: 'Delete a queue' })
  async deleteQueue(@Param('name') name: string) {
    await this.rabbitmqService.deleteQueue(name);
    return { success: true, queue: name, status: 'deleted' };
  }

  // --- Consumed Messages Log ---

  @Get('consumed')
  @ApiOperation({ summary: 'Get consumed messages log' })
  getConsumed() {
    return {
      messages: this.rabbitmqService.getConsumedMessages(),
      activeConsumers: this.rabbitmqService.getActiveConsumers(),
    };
  }

  @Post('consumed/clear')
  @ApiOperation({ summary: 'Clear consumed messages log' })
  clearConsumed() {
    this.rabbitmqService.clearConsumedMessages();
    return { success: true };
  }

  // --- Demo: Full Flow ---

  @Post('demo/task-flow')
  @ApiOperation({ summary: 'Demo: simulate task assignment flow through exchange' })
  async demoTaskFlow(
    @Body() body: { taskTitle?: string; assignee?: string },
  ) {
    const exchange = 'task.events';
    const routingKey = 'task.assigned';
    const queues = ['email-notifications', 'push-notifications', 'activity-log'];

    for (const queue of queues) {
      await this.rabbitmqService.bindQueueToExchange(queue, exchange, 'task.*', 'topic');
      await this.rabbitmqService.consume(queue, () => {});
    }

    const message = JSON.stringify({
      event: 'task.assigned',
      taskTitle: body.taskTitle || 'Fix login bug',
      assignee: body.assignee || 'John Doe',
      assignedBy: 'Test User',
      timestamp: new Date().toISOString(),
    });

    await this.rabbitmqService.publishToExchange(exchange, routingKey, message, 'topic');

    return {
      success: true,
      exchange,
      routingKey,
      queues,
      message: `Task "${body.taskTitle || 'Fix login bug'}" assigned to "${body.assignee || 'John Doe'}" — routed to ${queues.length} queues`,
    };
  }

  // ==============================================
  // Exchange Type Demos (Direct, Fanout, Topic, Headers)
  // ==============================================

  @Post('demo/direct')
  @ApiOperation({ summary: 'Demo: Direct exchange - exact routing key match' })
  async demoDirectExchange() {
    const exchange = 'demo.direct.orders';
    const queues = [
      { name: 'billing-service', key: 'order.paid' },
      { name: 'shipping-service', key: 'order.shipped' },
      { name: 'refund-service', key: 'order.cancelled' },
    ];

    // Setup: bind each queue with its exact routing key
    for (const q of queues) {
      await this.rabbitmqService.bindQueueToExchange(q.name, exchange, q.key, 'direct');
      await this.rabbitmqService.consume(q.name, () => {});
    }

    // Publish 3 messages with different routing keys
    const messages = [
      { key: 'order.paid', data: { orderId: 'ORD-001', amount: 99.99, customer: 'Alice' } },
      { key: 'order.shipped', data: { orderId: 'ORD-002', trackingNo: 'TRK-5678', carrier: 'FedEx' } },
      { key: 'order.cancelled', data: { orderId: 'ORD-003', reason: 'Customer request', refundAmount: 49.99 } },
    ];

    const results: { routingKey: string; deliveredTo: string }[] = [];
    for (const msg of messages) {
      await this.rabbitmqService.publishToExchange(
        exchange, msg.key,
        JSON.stringify({ ...msg.data, timestamp: new Date().toISOString() }),
        'direct',
      );
      // Direct: only the queue with exact matching key receives it
      const target = queues.find((q) => q.key === msg.key);
      results.push({ routingKey: msg.key, deliveredTo: target?.name || 'none' });
    }

    return {
      success: true,
      type: 'direct',
      exchange,
      description: 'Each message goes to EXACTLY ONE queue whose binding key matches the routing key',
      queues: queues.map((q) => ({ queue: q.name, bindingKey: q.key })),
      published: results,
    };
  }

  @Post('demo/fanout')
  @ApiOperation({ summary: 'Demo: Fanout exchange - broadcast to all queues' })
  async demoFanoutExchange() {
    const exchange = 'demo.fanout.signup';
    const queues = ['send-welcome-email', 'create-default-project', 'notify-admin-slack', 'analytics-tracking'];

    // Setup: bind all queues (routing key is ignored for fanout)
    for (const queue of queues) {
      await this.rabbitmqService.bindQueueToExchange(queue, exchange, '', 'fanout');
      await this.rabbitmqService.consume(queue, () => {});
    }

    // Publish one message → ALL queues receive it
    const message = JSON.stringify({
      event: 'user.registered',
      userId: 'USR-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      email: 'newuser@example.com',
      name: 'New User',
      timestamp: new Date().toISOString(),
    });

    await this.rabbitmqService.publishToExchange(exchange, '', message, 'fanout');

    return {
      success: true,
      type: 'fanout',
      exchange,
      description: 'ONE message broadcast to ALL 4 queues — routing key is completely ignored',
      queues,
      deliveredTo: queues, // all of them
    };
  }

  @Post('demo/topic')
  @ApiOperation({ summary: 'Demo: Topic exchange - pattern matching with * and #' })
  async demoTopicExchange() {
    const exchange = 'demo.topic.logs';
    const queues = [
      { name: 'error-alerts', pattern: 'app.*.error' },
      { name: 'payment-monitor', pattern: 'app.payment.#' },
      { name: 'log-archive', pattern: '#' },
    ];

    // Setup
    for (const q of queues) {
      await this.rabbitmqService.bindQueueToExchange(q.name, exchange, q.pattern, 'topic');
      await this.rabbitmqService.consume(q.name, () => {});
    }

    // Publish 4 messages with different routing keys
    const messages = [
      { key: 'app.auth.error', data: { service: 'auth', level: 'error', msg: 'Login failed 3 times' } },
      { key: 'app.payment.error', data: { service: 'payment', level: 'error', msg: 'Card declined' } },
      { key: 'app.payment.refund', data: { service: 'payment', level: 'info', msg: 'Refund processed $49.99' } },
      { key: 'app.ui.info', data: { service: 'ui', level: 'info', msg: 'Page rendered in 120ms' } },
    ];

    const results: { routingKey: string; deliveredTo: string[] }[] = [];
    for (const msg of messages) {
      await this.rabbitmqService.publishToExchange(
        exchange, msg.key,
        JSON.stringify({ ...msg.data, timestamp: new Date().toISOString() }),
        'topic',
      );
      // Determine which queues match
      const matched = queues.filter((q) => this.matchTopicPattern(q.pattern, msg.key)).map((q) => q.name);
      results.push({ routingKey: msg.key, deliveredTo: matched });
    }

    return {
      success: true,
      type: 'topic',
      exchange,
      description: 'Messages routed by PATTERN: * matches one word, # matches zero or more words',
      queues: queues.map((q) => ({ queue: q.name, pattern: q.pattern })),
      published: results,
    };
  }

  @Post('demo/headers')
  @ApiOperation({ summary: 'Demo: Headers exchange - route by message header attributes' })
  async demoHeadersExchange() {
    const exchange = 'demo.headers.reports';
    const queues: { name: string; headers: Record<string, string> }[] = [
      { name: 'pdf-printer', headers: { format: 'pdf', 'x-match': 'any' } },
      { name: 'finance-archive', headers: { department: 'finance', format: 'pdf', 'x-match': 'all' } },
      { name: 'hr-reports', headers: { department: 'hr', 'x-match': 'all' } },
    ];

    // Setup: bind with header matching rules
    for (const q of queues) {
      await this.rabbitmqService.bindQueueToExchange(q.name, exchange, '', 'headers', q.headers);
      await this.rabbitmqService.consume(q.name, () => {});
    }

    // Publish messages with different headers
    const messages = [
      {
        label: 'Finance PDF Report',
        headers: { format: 'pdf', department: 'finance' },
        data: { report: 'Q4 Revenue', total: '$1.2M' },
      },
      {
        label: 'HR CSV Export',
        headers: { format: 'csv', department: 'hr' },
        data: { report: 'Employee List', count: 150 },
      },
      {
        label: 'Marketing PDF',
        headers: { format: 'pdf', department: 'marketing' },
        data: { report: 'Campaign Results', clicks: 45000 },
      },
    ];

    const results: { label: string; headers: Record<string, string>; deliveredTo: string[] }[] = [];
    for (const msg of messages) {
      await this.rabbitmqService.publishToExchange(
        exchange, '', // no routing key for headers exchange
        JSON.stringify({ ...msg.data, timestamp: new Date().toISOString() }),
        'headers',
        msg.headers,
      );
      // Determine matches
      const matched = queues.filter((q) => this.matchHeaders(q.headers, msg.headers)).map((q) => q.name);
      results.push({ label: msg.label, headers: msg.headers, deliveredTo: matched });
    }

    return {
      success: true,
      type: 'headers',
      exchange,
      description: 'Messages routed by HEADER attributes, not routing key. x-match=all (ALL must match) or x-match=any (ANY can match)',
      queues: queues.map((q) => ({ queue: q.name, matchRule: q.headers['x-match'], headers: Object.fromEntries(Object.entries(q.headers).filter(([k]) => k !== 'x-match')) })),
      published: results,
    };
  }

  // ==============================================
  // Saga Orchestrator
  // ==============================================

  @Post('saga/run')
  @ApiOperation({ summary: 'Run Order Processing Saga with optional failure injection' })
  async runSaga(
    @Body()
    body: {
      orderId?: string;
      customer?: string;
      amount?: number;
      items?: number;
      failAtStep?: number;
      stepDelayMs?: number;
    },
  ) {
    const payload = {
      orderId: body.orderId || `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      customer: body.customer || 'John Doe',
      amount: body.amount ?? 99.99,
      items: body.items ?? 3,
    };

    const result = await this.sagaService.runOrderSaga(payload, {
      failAtStep: body.failAtStep,
      stepDelayMs: body.stepDelayMs ?? 400,
      compensationDelayMs: 250,
    });

    return result;
  }

  @Get('saga/logs')
  @ApiOperation({ summary: 'Get saga execution logs' })
  getSagaLogs() {
    return this.sagaService.getSagaLogs();
  }

  @Get('saga/:id')
  @ApiOperation({ summary: 'Get a specific saga by ID' })
  getSagaById(@Param('id') id: string) {
    return this.sagaService.getSagaById(id) || { error: 'Saga not found' };
  }

  @Post('saga/clear')
  @ApiOperation({ summary: 'Clear saga logs' })
  clearSagaLogs() {
    this.sagaService.clearLogs();
    return { success: true };
  }

  // --- Helper: Topic pattern matching (for display purposes) ---
  private matchTopicPattern(pattern: string, routingKey: string): boolean {
    const patternParts = pattern.split('.');
    const keyParts = routingKey.split('.');
    if (pattern === '#') return true;
    let pi = 0, ki = 0;
    while (pi < patternParts.length && ki < keyParts.length) {
      if (patternParts[pi] === '#') return true;
      if (patternParts[pi] === '*' || patternParts[pi] === keyParts[ki]) {
        pi++; ki++;
      } else {
        return false;
      }
    }
    return pi === patternParts.length && ki === keyParts.length;
  }

  // --- Helper: Headers matching (for display purposes) ---
  private matchHeaders(
    bindHeaders: Record<string, string>,
    msgHeaders: Record<string, string>,
  ): boolean {
    const xMatch = bindHeaders['x-match'] || 'all';
    const bindKeys = Object.keys(bindHeaders).filter((k) => k !== 'x-match');
    if (xMatch === 'all') {
      return bindKeys.every((k) => msgHeaders[k] === bindHeaders[k]);
    }
    return bindKeys.some((k) => msgHeaders[k] === bindHeaders[k]);
  }

  // ==============================================
  // Dead Letter Queue (DLQ) Demo
  // ==============================================

  @Post('dlq/start')
  @ApiOperation({ summary: 'Start DLQ consumer with failure config' })
  async dlqStart(@Body() body: DlqConfig) {
    await this.dlqService.startConsuming(body);
    return { success: true, status: 'consuming', config: body };
  }

  @Post('dlq/stop')
  @ApiOperation({ summary: 'Stop DLQ consumer' })
  async dlqStop() {
    await this.dlqService.stopConsuming();
    return { success: true, status: 'stopped' };
  }

  @Post('dlq/send')
  @ApiOperation({ summary: 'Send a message to the DLQ demo main queue' })
  async dlqSend(@Body() body: { payload?: Record<string, unknown> }) {
    const msg = await this.dlqService.sendMessage(
      body.payload || { action: 'process_order', orderId: `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}` },
    );
    return msg;
  }

  @Post('dlq/send-batch')
  @ApiOperation({ summary: 'Send multiple messages to the DLQ demo' })
  async dlqSendBatch(@Body() body: { count: number; payload?: Record<string, unknown> }) {
    const result = await this.dlqService.sendBatch(
      body.count || 5,
      body.payload || { action: 'process_order' },
    );
    return result;
  }

  @Post('dlq/retry/:id')
  @ApiOperation({ summary: 'Retry a dead-lettered message' })
  async dlqRetry(@Param('id') id: string) {
    const ok = await this.dlqService.retryDeadMessage(id);
    return { success: ok, messageId: id };
  }

  @Post('dlq/retry-all')
  @ApiOperation({ summary: 'Retry all dead-lettered messages' })
  async dlqRetryAll() {
    const count = await this.dlqService.retryAllDead();
    return { success: true, retriedCount: count };
  }

  @Post('dlq/discard/:id')
  @ApiOperation({ summary: 'Discard a dead-lettered message' })
  dlqDiscard(@Param('id') id: string) {
    const ok = this.dlqService.discardDeadMessage(id);
    return { success: ok, messageId: id };
  }

  @Post('dlq/discard-all')
  @ApiOperation({ summary: 'Discard all dead-lettered messages' })
  dlqDiscardAll() {
    const count = this.dlqService.discardAllDead();
    return { success: true, discardedCount: count };
  }

  @Get('dlq/messages')
  @ApiOperation({ summary: 'Get all tracked DLQ messages' })
  dlqGetMessages() {
    return {
      messages: this.dlqService.getMessages(),
      consuming: this.dlqService.isConsuming(),
    };
  }

  @Get('dlq/stats')
  @ApiOperation({ summary: 'Get DLQ queue stats' })
  async dlqGetStats() {
    return this.dlqService.getStats();
  }

  @Post('dlq/clear')
  @ApiOperation({ summary: 'Clear all DLQ tracking data' })
  dlqClear() {
    this.dlqService.clearAll();
    return { success: true };
  }

  // ==============================================
  // Outbox Pattern Demo
  // ==============================================

  @Post('outbox/order')
  @ApiOperation({ summary: 'Create an order (atomic: writes order + outbox row in one transaction)' })
  outboxCreateOrder(
    @Body() body: { customer?: string; amount?: number; items?: number },
  ) {
    return this.outboxService.createOrder({
      customer: body.customer || 'John Doe',
      amount: body.amount ?? +(Math.random() * 500 + 10).toFixed(2),
      items: body.items ?? Math.ceil(Math.random() * 5),
    });
  }

  @Post('outbox/order-batch')
  @ApiOperation({ summary: 'Create multiple orders atomically' })
  outboxCreateOrderBatch(
    @Body() body: { count?: number; customer?: string; amount?: number; items?: number },
  ) {
    return this.outboxService.createOrderBatch(body.count || 5, {
      customer: body.customer || 'Batch Customer',
      amount: body.amount ?? 99.99,
      items: body.items ?? 2,
    });
  }

  @Post('outbox/relay/start')
  @ApiOperation({ summary: 'Start the outbox relay poller' })
  outboxStartRelay() {
    this.outboxService.startRelay();
    return { success: true, status: 'relay started' };
  }

  @Post('outbox/relay/stop')
  @ApiOperation({ summary: 'Stop the outbox relay poller' })
  outboxStopRelay() {
    this.outboxService.stopRelay();
    return { success: true, status: 'relay stopped' };
  }

  @Post('outbox/broker/down')
  @ApiOperation({ summary: 'Simulate broker outage (relay will accumulate pending)' })
  outboxBrokerDown() {
    this.outboxService.setBrokerDown(true);
    return { success: true, brokerDown: true };
  }

  @Post('outbox/broker/up')
  @ApiOperation({ summary: 'Restore broker (relay will flush accumulated pending messages)' })
  outboxBrokerUp() {
    this.outboxService.setBrokerDown(false);
    return { success: true, brokerDown: false };
  }

  @Get('outbox/state')
  @ApiOperation({ summary: 'Get orders, outbox table, relay stats, and published messages' })
  outboxGetState() {
    return {
      orders: this.outboxService.getOrders(),
      outbox: this.outboxService.getOutbox(),
      published: this.outboxService.getPublishedMessages(),
      relay: this.outboxService.getRelayStats(),
    };
  }

  @Post('outbox/clear')
  @ApiOperation({ summary: 'Clear all outbox demo data' })
  outboxClear() {
    this.outboxService.clearAll();
    return { success: true };
  }

  // ==============================================
  // Circuit Breaker Demo
  // ==============================================

  @Post('cb/call')
  @ApiOperation({ summary: 'Make one call through the circuit breaker (to simulated payment API)' })
  async cbCall(@Body() body: { label?: string }) {
    return this.cbService.call(body.label);
  }

  @Post('cb/call-batch')
  @ApiOperation({ summary: 'Make N calls in rapid succession' })
  async cbCallBatch(@Body() body: { count?: number }) {
    return this.cbService.callBatch(body.count || 5);
  }

  @Post('cb/service/down')
  @ApiOperation({ summary: 'Simulate downstream service going down' })
  cbServiceDown() {
    this.cbService.setServiceDown(true);
    return { success: true, serviceDown: true };
  }

  @Post('cb/service/up')
  @ApiOperation({ summary: 'Restore downstream service' })
  cbServiceUp() {
    this.cbService.setServiceDown(false);
    return { success: true, serviceDown: false };
  }

  @Post('cb/reset')
  @ApiOperation({ summary: 'Manually reset circuit to CLOSED' })
  cbReset() {
    this.cbService.resetCircuit();
    return { success: true, state: 'closed' };
  }

  @Post('cb/trip')
  @ApiOperation({ summary: 'Manually trip circuit to OPEN' })
  cbTrip() {
    this.cbService.tripCircuit();
    return { success: true, state: 'open' };
  }

  @Post('cb/config')
  @ApiOperation({ summary: 'Update circuit breaker configuration' })
  cbUpdateConfig(@Body() body: Partial<CircuitBreakerConfig>) {
    this.cbService.updateConfig(body);
    return { success: true, config: this.cbService.getStatus().config };
  }

  @Get('cb/status')
  @ApiOperation({ summary: 'Get circuit breaker state, stats, and call log' })
  cbGetStatus() {
    return {
      status: this.cbService.getStatus(),
      calls: this.cbService.getCallLog(),
    };
  }

  @Post('cb/clear')
  @ApiOperation({ summary: 'Clear circuit breaker log and reset state' })
  cbClear() {
    this.cbService.clearLog();
    return { success: true };
  }

  // ─── Backpressure ─────────────────────────────────────────────────────────

  @Post('bp/start')
  @ApiOperation({ summary: 'Start producer/consumer simulation' })
  bpStart(@Body() body: Partial<BackpressureConfig>) {
    this.bpService.start(body);
    return { success: true, config: this.bpService.getStats().config };
  }

  @Post('bp/stop')
  @ApiOperation({ summary: 'Stop producer/consumer simulation' })
  bpStop() {
    this.bpService.stop();
    return { success: true };
  }

  @Post('bp/clear')
  @ApiOperation({ summary: 'Clear simulation state and logs' })
  bpClear() {
    this.bpService.clear();
    return { success: true };
  }

  @Post('bp/config')
  @ApiOperation({ summary: 'Update config (restarts simulation if running)' })
  bpConfig(@Body() body: Partial<BackpressureConfig>) {
    this.bpService.updateConfig(body);
    return { success: true, config: this.bpService.getStats().config };
  }

  @Get('bp/stats')
  @ApiOperation({ summary: 'Get live backpressure stats' })
  bpStats() {
    return {
      stats: this.bpService.getStats(),
      queue: this.bpService.getQueueSnapshot(),
      log: this.bpService.getMessageLog(),
    };
  }
}
