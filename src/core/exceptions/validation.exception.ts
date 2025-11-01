import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Validation exception with detailed field errors
 */
export class ValidationException extends HttpException {
  constructor(
    message: string,
    public readonly fieldErrors: Array<{
      field: string;
      message: string;
      value?: unknown;
      constraint?: string;
    }>,
  ) {
    super(
      {
        message,
        fieldErrors,
        statusCode: HttpStatus.BAD_REQUEST,
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  /**
   * Create from class-validator errors
   */
  static fromValidationErrors(
    errors: Array<{
      property: string;
      constraints?: Record<string, string>;
      value?: unknown;
    }>,
  ): ValidationException {
    const fieldErrors = errors.map((error) => ({
      field: error.property,
      message: error.constraints
        ? Object.values(error.constraints).join(', ')
        : 'Validation failed',
      value: error.value,
      constraint: error.constraints
        ? Object.keys(error.constraints)[0]
        : undefined,
    }));

    return new ValidationException('Validation failed', fieldErrors);
  }

  /**
   * Create for a single field
   */
  static singleField(
    field: string,
    message: string,
    value?: unknown,
  ): ValidationException {
    return new ValidationException('Validation failed', [
      { field, message, value },
    ]);
  }
}
