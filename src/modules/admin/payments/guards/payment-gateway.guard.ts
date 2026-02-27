import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Guards POST /admin/payments/verify so only an authorised payment gateway
 * can mark an order as paid.
 *
 * The caller must send the header:
 *   X-Gateway-Key: <value of PAYMENT_GATEWAY_KEY env var>
 *
 * In development, set PAYMENT_GATEWAY_KEY=dev-gateway-key (or any string).
 * In production, use a long random secret shared only with your gateway.
 */
@Injectable()
export class PaymentGatewayGuard implements CanActivate {
  private readonly expectedKey: string;

  constructor(private readonly config: ConfigService) {
    this.expectedKey =
      this.config.get<string>('PAYMENT_GATEWAY_KEY') ?? 'dev-gateway-key';
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-gateway-key'];

    console.debug(`[PaymentGatewayGuard] Expected key: ${this.expectedKey}, Provided key: ${provided}`);

    if (!provided || provided !== this.expectedKey) {
      throw new UnauthorizedException('Invalid or missing gateway key');
    }

    return true;
  }
}
