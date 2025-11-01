import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Messaging system exception
 * Use for broker connection, publish/subscribe errors
 */
export class MessagingException extends HttpException {
  constructor(
    message: string,
    public readonly broker: 'redis' | 'nats' | 'rabbitmq' | 'websocket',
    public readonly operation: string,
    public readonly originalError?: Error,
  ) {
    super(
      {
        message,
        broker,
        operation,
        originalError: originalError?.message,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Factory methods for common messaging exceptions
   */
  static connectionFailed(
    broker: MessagingException['broker'],
    error?: Error,
  ): MessagingException {
    return new MessagingException(
      `Failed to connect to ${broker}`,
      broker,
      'connect',
      error,
    );
  }

  static publishFailed(
    broker: MessagingException['broker'],
    channel: string,
    error?: Error,
  ): MessagingException {
    return new MessagingException(
      `Failed to publish message to ${broker} channel: ${channel}`,
      broker,
      'publish',
      error,
    );
  }

  static subscribeFailed(
    broker: MessagingException['broker'],
    channel: string,
    error?: Error,
  ): MessagingException {
    return new MessagingException(
      `Failed to subscribe to ${broker} channel: ${channel}`,
      broker,
      'subscribe',
      error,
    );
  }

  static timeoutError(
    broker: MessagingException['broker'],
    operation: string,
    timeout: number,
  ): MessagingException {
    return new MessagingException(
      `${broker} ${operation} timed out after ${timeout}ms`,
      broker,
      operation,
    );
  }
}
