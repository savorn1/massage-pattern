/**
 * Standard API response interface for consistent response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
  path?: string;
}

/**
 * Paginated response interface for list endpoints
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  limit: number;
  skip: number;
  hasMore?: boolean;
}

/**
 * Health check response interface
 */
export interface HealthResponse {
  success: boolean;
  status: string;
  timestamp: string;
  services?: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
    };
  };
}

/**
 * Error response interface for standardized error handling
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  errorCode?: string;
  details?: Record<string, unknown>;
  fieldErrors?: Array<FieldError>;
  stack?: string;
}

/**
 * Field error interface for validation errors
 */
export interface FieldError {
  field: string;
  message: string;
  value?: unknown;
  constraint?: string;
}
