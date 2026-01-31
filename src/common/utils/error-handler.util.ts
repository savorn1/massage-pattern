import { Logger } from '@nestjs/common';
import { BusinessException } from '../../core/exceptions/business.exception';
import { MessagingException } from '../../core/exceptions/messaging.exception';
import { DatabaseException } from '../../core/exceptions/database.exception';

/**
 * Error handler utility for common error handling patterns
 */
export class ErrorHandler {
  /**
   * Wrap async operation with error handling
   */
  static async handleAsync<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    logger?: Logger,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (logger) {
        logger.error(
          errorMessage,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    }
  }

  /**
   * Handle database operation with error mapping
   */
  static async handleDatabaseOperation<T>(
    operation: () => Promise<T>,
    operationType: 'create' | 'read' | 'update' | 'delete' | 'query',
    collection: string,
    logger?: Logger,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (logger) {
        logger.error(
          `Database ${operationType} failed on ${collection}`,
          error instanceof Error ? error.stack : undefined,
        );
      }

      throw DatabaseException.operationFailed(
        operationType,
        collection,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Handle messaging operation with error mapping
   */
  static async handleMessagingOperation<T>(
    operation: () => Promise<T>,
    broker: 'redis' | 'nats' | 'rabbitmq' | 'websocket',
    operationType: string,
    logger?: Logger,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (logger) {
        logger.error(
          `${broker} ${operationType} failed`,
          error instanceof Error ? error.stack : undefined,
        );
      }

      throw new MessagingException(
        `${broker} ${operationType} failed`,
        broker,
        operationType,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Safely parse error to get message
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return 'An unknown error occurred';
  }

  /**
   * Check if error is operational (expected) vs programmer error
   */
  static isOperationalError(error: unknown): boolean {
    if (
      error instanceof BusinessException ||
      error instanceof MessagingException ||
      error instanceof DatabaseException
    ) {
      return true;
    }
    return false;
  }

  /**
   * Transform error to safe error (hide sensitive info in production)
   */
  static toSafeError(error: unknown, isDevelopment: boolean): Error {
    if (error instanceof Error) {
      if (isDevelopment) {
        return error;
      }
      // In production, return generic error for non-operational errors
      if (this.isOperationalError(error)) {
        return error;
      }
      return new Error('An internal error occurred');
    }
    return new Error('An unexpected error occurred');
  }
}
