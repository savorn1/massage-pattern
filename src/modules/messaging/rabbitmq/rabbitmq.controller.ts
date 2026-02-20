import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RabbitmqService } from './rabbitmq.service';

@ApiTags('RabbitMQ')
@Controller('rabbitmq')
export class RabbitmqController {
  constructor(private readonly rabbitmqService: RabbitmqService) {}

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
}
