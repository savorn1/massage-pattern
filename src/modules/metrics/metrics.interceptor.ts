import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const route =
      (request.route as { path?: string } | undefined)?.path ?? request.path;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          this.record(method, route, String(response.statusCode), start);
        },
        error: (err: Error & { status?: number }) => {
          this.record(method, route, String(err.status ?? 500), start);
        },
      }),
    );
  }

  private record(
    method: string,
    route: string,
    statusCode: string,
    start: number,
  ): void {
    const duration = Date.now() - start;
    this.metricsService.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.metricsService.httpRequestDurationMs.observe({ method, route }, duration);
  }
}
