import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const LOG_ENABLED = process.env.LOG_ENABLED !== 'false';
const LOG_HANDLER_NAME = process.env.LOG_HANDLER_NAME !== 'false';
const LOG_SLOW_MS = parseInt(process.env.LOG_SLOW_MS || '1000', 10);

// ANSI color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
};

function colorMethod(method: string): string {
  switch (method) {
    case 'GET': return `${c.green}${c.bold}${method}${c.reset}`;
    case 'POST': return `${c.cyan}${c.bold}${method}${c.reset}`;
    case 'PUT':
    case 'PATCH': return `${c.yellow}${c.bold}${method}${c.reset}`;
    case 'DELETE': return `${c.red}${c.bold}${method}${c.reset}`;
    default: return `${c.white}${method}${c.reset}`;
  }
}

function colorStatus(status: number): string {
  if (status < 300) return `${c.green}${c.bold}${status}${c.reset}`;
  if (status < 400) return `${c.cyan}${status}${c.reset}`;
  if (status < 500) return `${c.yellow}${c.bold}${status}${c.reset}`;
  return `${c.bgRed}${c.bold}${status}${c.reset}`;
}

function colorDelay(delay: number): string {
  if (delay < 200) return `${c.green}${delay}ms${c.reset}`;
  if (delay < LOG_SLOW_MS) return `${c.yellow}${delay}ms${c.reset}`;
  return `${c.red}${c.bold}${delay}ms${c.reset}`;
}

/**
 * Logging interceptor for HTTP requests.
 *
 * Controlled via env vars:
 *   LOG_ENABLED      – toggle all HTTP logging (default: true)
 *   LOG_HANDLER_NAME – append [Controller.handler] to log (default: true)
 *   LOG_SLOW_MS      – warn if response exceeds this ms threshold (default: 1000)
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!LOG_ENABLED) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    const handlerSuffix = LOG_HANDLER_NAME
      ? ` ${c.dim}[${context.getClass().name}.${context.getHandler().name}]${c.reset}`
      : '';

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const delay = Date.now() - now;

          const msg = `${colorMethod(method)} ${url} ${colorStatus(response.statusCode)} - ${colorDelay(delay)}${handlerSuffix}`;

          if (delay >= LOG_SLOW_MS) {
            this.logger.warn(`${c.yellow}SLOW${c.reset} ${msg}`);
          } else {
            this.logger.log(msg);
          }
        },
        error: (error: Error & { status?: number }) => {
          const delay = Date.now() - now;
          const status = error.status ?? 500;
          this.logger.error(
            `${colorMethod(method)} ${url} ${colorStatus(status)} - ${colorDelay(delay)} - ${error.message ?? 'Unknown error'}${handlerSuffix}`,
          );
        },
      }),
    );
  }
}
