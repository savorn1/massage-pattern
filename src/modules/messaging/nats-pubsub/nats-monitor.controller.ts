import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { NatsPubSubService } from './nats-pubsub.service';

@ApiTags('admin/nats')
@ApiBearerAuth('JWT-auth')
@Controller('admin/nats')
@UseGuards(JwtAuthGuard)
export class NatsMonitorController {
  // NATS monitoring HTTP port (running inside docker on same host)
  private readonly monitorBase = process.env.NATS_MONITOR_URL || 'http://localhost:8222';

  constructor(private readonly nats: NatsPubSubService) {}

  /**
   * GET /admin/nats/monitor
   *
   * Aggregates three NATS monitoring endpoints and app-level subscription info
   * into one response for the dev-tools panel.
   */
  @Get('monitor')
  @ApiOperation({ summary: 'Get live NATS server stats (dev tool)' })
  async getMonitorStats() {
    const [varz, connz, subsz] = await Promise.all([
      this.fetchNats('varz'),
      this.fetchNats('connz'),
      this.fetchNats('subsz'),
    ]);

    return {
      // Server vitals — messages/sec, uptime, memory
      server: {
        version:    varz?.version   ?? 'unknown',
        uptime:     varz?.uptime    ?? 'unknown',
        now:        varz?.now       ?? null,
        inMsgs:     varz?.in_msgs   ?? 0,
        outMsgs:    varz?.out_msgs  ?? 0,
        inBytes:    varz?.in_bytes  ?? 0,
        outBytes:   varz?.out_bytes ?? 0,
        slowConsumers: varz?.slow_consumers ?? 0,
        mem:        varz?.mem       ?? 0,
        // Rate snapshot since server start
        inMsgsRate:  varz?.in_msgs_rate  ?? 0,
        outMsgsRate: varz?.out_msgs_rate ?? 0,
        isConnected: this.nats.isConnected(),
      },

      // Active client connections
      connections: {
        total:   connz?.num_connections ?? 0,
        clients: (connz?.connections ?? []).map((c: any) => ({
          id:       c.cid,
          name:     c.name || 'anonymous',
          ip:       c.ip,
          subs:     c.num_subs,
          inMsgs:   c.in_msgs,
          outMsgs:  c.out_msgs,
          lang:     c.lang,
          version:  c.version,
        })),
      },

      // Active subscriptions on the server
      subscriptions: {
        total:    subsz?.num_subscriptions ?? 0,
        subjects: (subsz?.subscriptions ?? []).map((s: any) => ({
          subject: s.subject,
          sid:     s.sid,
          client:  s.client_id,
        })),
      },

      // App-level: subjects this NestJS process subscribed to
      appSubscriptions: this.nats.getSubscribedSubjects(),
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async fetchNats(endpoint: string): Promise<any> {
    try {
      const res = await fetch(`${this.monitorBase}/${endpoint}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;   // NATS monitoring unreachable — return null gracefully
    }
  }
}
