import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Database operation exception
 * Use for MongoDB and other database errors
 */
export class DatabaseException extends HttpException {
  constructor(
    message: string,
    public readonly operation:
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'query',
    public readonly collection?: string,
    public readonly originalError?: Error,
  ) {
    super(
      {
        message,
        operation,
        collection,
        originalError: originalError?.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Factory methods for common database exceptions
   */
  static operationFailed(
    operation: DatabaseException['operation'],
    collection: string,
    error?: Error,
  ): DatabaseException {
    return new DatabaseException(
      `Database ${operation} operation failed on ${collection}`,
      operation,
      collection,
      error,
    );
  }

  static connectionFailed(error?: Error): DatabaseException {
    return new DatabaseException(
      'Database connection failed',
      'query',
      undefined,
      error,
    );
  }

  static queryTimeout(collection: string, timeout: number): DatabaseException {
    return new DatabaseException(
      `Database query timed out after ${timeout}ms`,
      'query',
      collection,
    );
  }

  static duplicateKey(collection: string, field: string): DatabaseException {
    return new DatabaseException(
      `Duplicate key error in ${collection}: ${field} already exists`,
      'create',
      collection,
    );
  }
}
