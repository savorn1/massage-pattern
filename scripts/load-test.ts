/**
 * Standalone WebSocket Load Test Script
 *
 * Run from a SEPARATE terminal (not the API server) to avoid
 * competing for resources with the server being tested.
 *
 * Usage:
 *   npx ts-node scripts/load-test.ts --clients 2000 --room load-test:room --mps 100 --duration 60
 *   npx ts-node scripts/load-test.ts --clients 5000 --servers http://server1:3000,http://server2:3000
 *
 * Options:
 *   --clients    Number of virtual clients (default: 100)
 *   --room       Room to join (default: load-test:default)
 *   --mps        Messages per second (default: 10)
 *   --duration   Test duration in seconds (default: 30)
 *   --servers    Comma-separated server URLs (default: http://localhost:3000)
 *   --batch      Batch size for connection creation (default: 50)
 *   --ramp       Ramp-up time in seconds to gradually connect clients (default: 0)
 */

import { io, Socket } from 'socket.io-client';

// Parse CLI arguments
function parseArgs(): {
  clients: number;
  room: string;
  mps: number;
  duration: number;
  servers: string[];
  batch: number;
  ramp: number;
} {
  const args = process.argv.slice(2);
  const get = (flag: string, defaultVal: string): string => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
  };

  return {
    clients: parseInt(get('--clients', '100'), 10),
    room: get('--room', 'load-test:default'),
    mps: parseInt(get('--mps', '10'), 10),
    duration: parseInt(get('--duration', '30'), 10),
    servers: get('--servers', 'http://localhost:3000').split(','),
    batch: parseInt(get('--batch', '50'), 10),
    ramp: parseInt(get('--ramp', '0'), 10),
  };
}

// Stats
let totalSent = 0;
let totalReceived = 0;
let errors = 0;
const latencies: number[] = [];
const clients: Socket[] = [];
let running = true;

function getStats() {
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg =
    sorted.length > 0
      ? sorted.reduce((s, l) => s + l, 0) / sorted.length
      : 0;

  return {
    connected: clients.filter((c) => c.connected).length,
    total: clients.length,
    sent: totalSent,
    received: totalReceived,
    avgLatency: Math.round(avg * 100) / 100,
    minLatency: sorted[0] || 0,
    maxLatency: sorted[sorted.length - 1] || 0,
    p95Latency: sorted[Math.floor(sorted.length * 0.95)] || 0,
    p99Latency: sorted[Math.floor(sorted.length * 0.99)] || 0,
    errors,
  };
}

function createClient(
  serverUrl: string,
  room: string,
  index: number,
): Promise<Socket | null> {
  return new Promise((resolve) => {
    const client = io(serverUrl, {
      transports: ['websocket'],
      auth: { username: `loadtest-${index}` },
      reconnection: false,
      timeout: 10000,
    });

    const timeout = setTimeout(() => {
      errors++;
      resolve(null);
    }, 10000);

    client.on('connect', () => {
      clearTimeout(timeout);
      client.emit('joinRoom', { room });
      resolve(client);
    });

    client.on('connect_error', (err) => {
      clearTimeout(timeout);
      errors++;
      resolve(null);
    });

    // Latency measurement
    client.on('load-test:ping', (data: { sentAt: number }) => {
      const latency = Date.now() - data.sentAt;
      latencies.push(latency);
      totalReceived++;
      if (latencies.length > 10000) {
        latencies.splice(0, latencies.length - 10000);
      }
    });

    // Count other events
    const events = [
      'task:created',
      'task:updated',
      'task:deleted',
      'project:created',
      'project:updated',
    ];
    for (const event of events) {
      client.on(event, () => totalReceived++);
    }
  });
}

function printHeader(config: ReturnType<typeof parseArgs>) {
  console.log('\n' + '='.repeat(60));
  console.log('  WebSocket Load Test');
  console.log('='.repeat(60));
  console.log(`  Clients:    ${config.clients}`);
  console.log(`  Servers:    ${config.servers.join(', ')}`);
  console.log(`  Room:       ${config.room}`);
  console.log(`  Msg/sec:    ${config.mps}`);
  console.log(`  Duration:   ${config.duration}s`);
  console.log(`  Batch size: ${config.batch}`);
  if (config.ramp > 0) {
    console.log(`  Ramp-up:    ${config.ramp}s`);
  }
  console.log('='.repeat(60) + '\n');
}

function printStats(elapsed: number) {
  const stats = getStats();
  const throughput =
    elapsed > 0 ? Math.round(totalSent / elapsed) : 0;

  // Clear line and print
  process.stdout.write('\r\x1b[K');
  process.stdout.write(
    `[${elapsed}s] ` +
      `Conn: ${stats.connected}/${stats.total} | ` +
      `Sent: ${stats.sent} | ` +
      `Recv: ${stats.received} | ` +
      `${throughput} msg/s | ` +
      `Latency avg:${stats.avgLatency}ms p95:${stats.p95Latency}ms p99:${stats.p99Latency}ms | ` +
      `Err: ${stats.errors}`,
  );
}

function printFinalReport(elapsed: number) {
  const stats = getStats();
  const throughput =
    elapsed > 0 ? Math.round(totalSent / elapsed) : 0;

  console.log('\n\n' + '='.repeat(60));
  console.log('  LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`  Duration:           ${elapsed}s`);
  console.log(`  Connected Clients:  ${stats.connected}/${stats.total}`);
  console.log(`  Messages Sent:      ${stats.sent}`);
  console.log(`  Messages Received:  ${stats.received}`);
  console.log(`  Throughput:         ${throughput} msg/s`);
  console.log('  ---');
  console.log(`  Avg Latency:        ${stats.avgLatency}ms`);
  console.log(`  Min Latency:        ${stats.minLatency}ms`);
  console.log(`  Max Latency:        ${stats.maxLatency}ms`);
  console.log(`  P95 Latency:        ${stats.p95Latency}ms`);
  console.log(`  P99 Latency:        ${stats.p99Latency}ms`);
  console.log('  ---');
  console.log(`  Errors:             ${stats.errors}`);
  console.log(
    `  Delivery Rate:      ${stats.sent > 0 ? ((stats.received / (stats.sent * stats.connected)) * 100).toFixed(1) : 0}%`,
  );
  console.log('='.repeat(60) + '\n');
}

async function main() {
  const config = parseArgs();
  printHeader(config);

  // Phase 1: Connect clients
  console.log(`Connecting ${config.clients} clients...`);

  const rampDelay = config.ramp > 0
    ? (config.ramp * 1000) / Math.ceil(config.clients / config.batch)
    : 100;

  for (let i = 0; i < config.clients; i += config.batch) {
    if (!running) break;

    const batchCount = Math.min(config.batch, config.clients - i);
    const promises: Promise<Socket | null>[] = [];

    for (let j = 0; j < batchCount; j++) {
      // Round-robin across servers
      const serverUrl = config.servers[(i + j) % config.servers.length];
      promises.push(createClient(serverUrl, config.room, i + j));
    }

    const results = await Promise.all(promises);
    for (const client of results) {
      if (client) clients.push(client);
    }

    const connected = clients.filter((c) => c.connected).length;
    process.stdout.write(
      `\r  Connected: ${connected}/${config.clients} (errors: ${errors})`,
    );

    await new Promise((r) => setTimeout(r, rampDelay));
  }

  const connectedCount = clients.filter((c) => c.connected).length;
  console.log(
    `\n\nAll clients connected: ${connectedCount}/${config.clients}\n`,
  );

  if (connectedCount === 0) {
    console.error('No clients connected. Check if the server is running.');
    process.exit(1);
  }

  // Phase 2: Send messages
  console.log(`Sending messages at ${config.mps} msg/s for ${config.duration}s...\n`);

  const startTime = Date.now();
  const connectedClients = clients.filter((c) => c.connected);

  const msgInterval = config.mps > 0
    ? setInterval(() => {
        if (!running) return;
        const client =
          connectedClients[
            Math.floor(Math.random() * connectedClients.length)
          ];
        if (client?.connected) {
          client.emit('roomMessage', {
            room: config.room,
            event: 'load-test:ping',
            data: { sentAt: Date.now() },
          });
          totalSent++;
        }
      }, 1000 / config.mps)
    : null;

  // Stats display interval
  const statsInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    printStats(elapsed);
  }, 1000);

  // Wait for duration
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      running = false;
      resolve();
    }, config.duration * 1000);
  });

  // Cleanup
  if (msgInterval) clearInterval(msgInterval);
  clearInterval(statsInterval);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  printFinalReport(elapsed);

  // Disconnect all
  console.log('Disconnecting clients...');
  for (const client of clients) {
    client.disconnect();
  }

  console.log('Done.\n');
  process.exit(0);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nInterrupted! Cleaning up...');
  running = false;
  const elapsed = latencies.length > 0
    ? Math.round((Date.now() - (Date.now() - latencies[latencies.length - 1])) / 1000)
    : 0;
  printFinalReport(elapsed);
  for (const client of clients) {
    client.disconnect();
  }
  process.exit(0);
});

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
