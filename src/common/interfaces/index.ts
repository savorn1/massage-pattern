// ════════════════════════════════════════════════════════════════════════════
// API Response Interfaces
// ════════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Messaging Interfaces
// ════════════════════════════════════════════════════════════════════════════

export interface MessagePayload {
  id?: string;
  data: unknown;
  timestamp: number;
  source?: string;
}

export interface PublishResult {
  success: boolean;
  subscriberCount?: number;
  messageId?: string;
}

export interface ConsumeOptions {
  batchSize?: number;
  blockMs?: number;
  autoAck?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Job/Queue Interfaces
// ════════════════════════════════════════════════════════════════════════════

export interface JobOptions {
  delay?: number;
  priority?: number;
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete?: boolean;
  removeOnFail?: boolean | number;
}

export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  processingTime?: number;
}

export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Event Interfaces
// ════════════════════════════════════════════════════════════════════════════

export interface EventPayload<T = unknown> {
  event: string;
  data: T;
  timestamp: number;
  correlationId?: string;
}

export interface UserEvent {
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export interface OrderEvent {
  orderId: string;
  status: string;
  customerId: string;
  total?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Service Interfaces
// ════════════════════════════════════════════════════════════════════════════

export interface ServiceHealth {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  service: string;
  details?: Record<string, unknown>;
}

export interface MessagingService {
  publish(channel: string, message: unknown): Promise<PublishResult>;
  subscribe(
    channel: string,
    callback: (message: unknown) => void,
  ): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  isConnected(): boolean;
}

export interface QueueService {
  addJob(queue: string, data: unknown, options?: JobOptions): Promise<string>;
  getJob(queue: string, jobId: string): Promise<unknown>;
  removeJob(queue: string, jobId: string): Promise<boolean>;
  getMetrics(queue: string): Promise<QueueMetrics>;
}
