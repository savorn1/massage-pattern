// Default config
export * from './default-config.constant';
export * from './roles.constant';

// Queue names
export const QUEUE_NAMES = {
  EMAILS: 'emails',
  IMAGES: 'images',
  REPORTS: 'reports',
  NOTIFICATIONS: 'notifications',
  DOCUMENTS: 'documents',
  INVENTORY: 'inventory',
  SECURITY: 'security',
} as const;

// Stream names
export const STREAM_NAMES = {
  USER_AUDIT_LOG: 'user-audit-log',
  ORDER_EVENTS: 'order-events',
  ANALYTICS_EVENTS: 'analytics-events',
  FILE_UPLOADS: 'file-uploads',
  CHAT_PREFIX: 'chat:',
} as const;

// Pub/Sub channels
export const PUBSUB_CHANNELS = {
  USER_EVENTS: 'user-events',
  ORDER_EVENTS: 'orders-live',
  CACHE_INVALIDATION: 'cache-invalidation',
  ANALYTICS_LIVE: 'analytics-live',
} as const;

// RabbitMQ queues
export const RABBITMQ_QUEUES = {
  PAYMENT: 'payment-queue',
  EMAIL_JOBS: 'email-jobs',
  INVENTORY_JOBS: 'inventory-jobs',
} as const;

// Default configuration values
export const DEFAULTS = {
  // Pagination
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Timeouts (ms)
  REQUEST_TIMEOUT: 5000,
  CONNECTION_TIMEOUT: 10000,

  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,

  // Worker settings
  EMAIL_CONCURRENCY: 5,
  IMAGE_CONCURRENCY: 3,
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_DURATION: 60000,
} as const;

// HTTP Status messages
export const HTTP_MESSAGES = {
  SUCCESS: 'Operation completed successfully',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  NOT_FOUND: 'Resource not found',
  BAD_REQUEST: 'Invalid request',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  INTERNAL_ERROR: 'Internal server error',
} as const;
