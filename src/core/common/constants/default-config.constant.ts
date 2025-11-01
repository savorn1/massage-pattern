/**
 * Default configuration constants
 */
export const DEFAULT_CONFIG = {
  PORT: 3000,

  // Pagination defaults
  PAGINATION: {
    DEFAULT_LIMIT: 100,
    MAX_LIMIT: 1000,
    DEFAULT_SKIP: 0,
  },

  // WebSocket configuration
  WEBSOCKET: {
    CORS_ORIGIN: '*',
    RECONNECTION_TIMEOUT: 30000, // 30 seconds
    PING_INTERVAL: 25000, // 25 seconds
    PING_TIMEOUT: 5000, // 5 seconds
  },

  // Redis configuration
  REDIS: {
    HOST: 'localhost',
    PORT: 6379,
    RETRY_DELAY_MAX: 2000, // 2 seconds
    RETRY_ATTEMPTS: 10,
  },

  // NATS configuration
  NATS: {
    URL: 'nats://localhost:4222',
    REQUEST_TIMEOUT: 5000, // 5 seconds
  },

  // RabbitMQ configuration
  RABBITMQ: {
    URL: 'amqp://localhost:5672',
    QUEUE_OPTIONS: {
      durable: true,
    },
  },

  // MongoDB configuration
  MONGODB: {
    URI: 'mongodb://admin:password@localhost:27017/messaging-patterns?authSource=admin',
  },
} as const;
