import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

/**
 * Base class for messaging services with common lifecycle management
 */
export abstract class BaseMessagingService
  implements OnModuleInit, OnModuleDestroy
{
  protected abstract readonly logger: Logger;
  protected abstract readonly serviceName: string;

  onModuleInit(): void {
    this.logger.log(`${this.serviceName} initialized`);
  }

  onModuleDestroy(): void {
    this.logger.log(`${this.serviceName} destroyed`);
  }

  /**
   * Standard error handling method
   */
  protected handleError(operation: string, error: any): never {
    this.logger.error(`Failed to ${operation}`, error);
    throw error;
  }

  /**
   * Log successful operation
   */
  protected logSuccess(operation: string, details?: string): void {
    const message = details
      ? `${operation}: ${details}`
      : `${operation} completed successfully`;
    this.logger.log(message);
  }
}
