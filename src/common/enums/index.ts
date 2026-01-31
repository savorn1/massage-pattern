// ════════════════════════════════════════════════════════════════════════════
// Message Types
// ════════════════════════════════════════════════════════════════════════════

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  VIDEO = 'video',
  AUDIO = 'audio',
  SYSTEM = 'system',
}

// ════════════════════════════════════════════════════════════════════════════
// Job Status
// ════════════════════════════════════════════════════════════════════════════

export enum JobStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused',
}

// ════════════════════════════════════════════════════════════════════════════
// Event Types
// ════════════════════════════════════════════════════════════════════════════

export enum UserEventType {
  REGISTERED = 'user_registered',
  LOGGED_IN = 'user_logged_in',
  LOGGED_OUT = 'user_logged_out',
  UPDATED = 'user_updated',
  DELETED = 'user_deleted',
}

export enum OrderEventType {
  CREATED = 'order_created',
  PAID = 'order_paid',
  SHIPPED = 'order_shipped',
  DELIVERED = 'order_delivered',
  CANCELLED = 'order_cancelled',
  REFUNDED = 'order_refunded',
}

// ════════════════════════════════════════════════════════════════════════════
// Connection Status
// ════════════════════════════════════════════════════════════════════════════

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

// ════════════════════════════════════════════════════════════════════════════
// Priority Levels
// ════════════════════════════════════════════════════════════════════════════

export enum Priority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 5,
  LOW = 10,
}

// ════════════════════════════════════════════════════════════════════════════
// Image Operations
// ════════════════════════════════════════════════════════════════════════════

export enum ImageOperation {
  RESIZE = 'resize',
  CROP = 'crop',
  COMPRESS = 'compress',
  WATERMARK = 'watermark',
  CONVERT = 'convert',
}

export enum ImageFormat {
  JPG = 'jpg',
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  GIF = 'gif',
}
