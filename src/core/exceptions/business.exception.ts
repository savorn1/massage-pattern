import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Business logic exception
 * Use for domain/business rule violations
 */
export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly errorCode?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(
      {
        message,
        errorCode,
        details,
        statusCode,
      },
      statusCode,
    );
  }

  /**
   * Factory methods for common business exceptions
   */
  static invalidOperation(
    message: string,
    details?: Record<string, unknown>,
  ): BusinessException {
    return new BusinessException(
      message,
      HttpStatus.BAD_REQUEST,
      'INVALID_OPERATION',
      details,
    );
  }

  static resourceNotFound(resource: string, id?: string): BusinessException {
    return new BusinessException(
      `${resource}${id ? ` with ID ${id}` : ''} not found`,
      HttpStatus.NOT_FOUND,
      'RESOURCE_NOT_FOUND',
      { resource, id },
    );
  }

  static duplicateResource(
    resource: string,
    field?: string,
  ): BusinessException {
    return new BusinessException(
      `${resource} already exists${field ? ` with this ${field}` : ''}`,
      HttpStatus.CONFLICT,
      'DUPLICATE_RESOURCE',
      { resource, field },
    );
  }

  static validationFailed(
    message: string,
    errors?: Record<string, unknown>,
  ): BusinessException {
    return new BusinessException(
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      'VALIDATION_FAILED',
      errors,
    );
  }
}
