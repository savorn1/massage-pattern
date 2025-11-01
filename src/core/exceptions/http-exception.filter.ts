import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from './business.exception';
import { MessagingException } from './messaging.exception';
import { DatabaseException } from './database.exception';
import { ValidationException } from './validation.exception';

interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  errorCode?: string;
  details?: Record<string, unknown>;
  fieldErrors?: Array<{
    field: string;
    message: string;
    value?: unknown;
    constraint?: string;
  }>;
  stack?: string;
}

/**
 * Global HTTP exception filter with enhanced error handling
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // Log the error
    this.logError(exception, request, errorResponse);

    // Send response
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Handle custom exceptions
    if (exception instanceof BusinessException) {
      return {
        success: false,
        error: 'Business Error',
        message: exception.message,
        statusCode: exception.getStatus(),
        timestamp,
        path,
        errorCode: exception.errorCode,
        details: exception.details,
      };
    }

    if (exception instanceof MessagingException) {
      return {
        success: false,
        error: 'Messaging Error',
        message: exception.message,
        statusCode: exception.getStatus(),
        timestamp,
        path,
        details: {
          broker: exception.broker,
          operation: exception.operation,
          originalError: exception.originalError?.message,
        },
      };
    }

    if (exception instanceof DatabaseException) {
      return {
        success: false,
        error: 'Database Error',
        message: exception.message,
        statusCode: exception.getStatus(),
        timestamp,
        path,
        details: {
          operation: exception.operation,
          collection: exception.collection,
          originalError: exception.originalError?.message,
        },
      };
    }

    if (exception instanceof ValidationException) {
      return {
        success: false,
        error: 'Validation Error',
        message: exception.message,
        statusCode: exception.getStatus(),
        timestamp,
        path,
        fieldErrors: exception.fieldErrors,
      };
    }

    // Handle standard HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message = exception.message;
      let errorCode: string | undefined;
      let details: Record<string, unknown> | undefined;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message =
          (typeof responseObj.message === 'string'
            ? responseObj.message
            : Array.isArray(responseObj.message)
              ? responseObj.message.join(', ')
              : undefined) || exception.message;
        errorCode =
          typeof responseObj.errorCode === 'string'
            ? responseObj.errorCode
            : undefined;
        details =
          typeof responseObj.details === 'object'
            ? (responseObj.details as Record<string, unknown>)
            : undefined;
      }

      return {
        success: false,
        error: this.getErrorName(status),
        message,
        statusCode: status,
        timestamp,
        path,
        errorCode,
        details,
      };
    }

    // Handle generic errors
    if (exception instanceof Error) {
      return {
        success: false,
        error: 'Internal Server Error',
        message: exception.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp,
        path,
        stack:
          process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      };
    }

    // Handle unknown exceptions
    return {
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp,
      path,
    };
  }

  private logError(
    exception: unknown,
    request: Request,
    errorResponse: ErrorResponse,
  ): void {
    const { method, url } = request;
    const { statusCode, message, errorCode } = errorResponse;

    const logMessage = `${method} ${url} - ${statusCode} - ${message}${errorCode ? ` [${errorCode}]` : ''}`;

    if (statusCode >= 500) {
      this.logger.error(
        logMessage,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (statusCode >= 400) {
      this.logger.warn(logMessage);
    } else {
      this.logger.log(logMessage);
    }
  }

  private getErrorName(statusCode: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return errorNames[statusCode] || 'Error';
  }
}
