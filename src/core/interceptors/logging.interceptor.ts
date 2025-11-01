import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Logging interceptor for HTTP requests
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const delay = Date.now() - now;
          this.logger.log(
            `${method} ${url} ${response.statusCode} - ${delay}ms`,
          );
        },
        error: (error: Error & { status?: number }) => {
          const delay = Date.now() - now;
          const status = error.status ?? 500;
          const message = error.message ?? 'Unknown error';
          this.logger.error(
            `${method} ${url} ${status} - ${delay}ms - ${message}`,
          );
        },
      }),
    );
  }
}
