import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

interface JwtPayload {
  sub: string;
  username?: string;
  email?: string;
}

/**
 * WsAuthGuard — validates JWT tokens on WebSocket events.
 *
 * Token is read from (in priority order):
 *   1. socket.handshake.auth.token
 *   2. Authorization header ("Bearer <token>")
 *
 * On success, attaches { id, username } to client.data.user so handlers
 * can read the verified identity without re-parsing the token.
 *
 * Replaces the previous static-string comparison which offered no expiry,
 * no per-user identity, and no revocation support.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const raw: unknown =
      client.handshake.auth?.token ??
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!raw || typeof raw !== 'string') {
      throw new WsException('Unauthorized: token missing');
    }

    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new WsException('Server misconfiguration: JWT_SECRET not set');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(raw, { secret });
    } catch {
      throw new WsException('Unauthorized: invalid or expired token');
    }

    client.data.user = {
      id: payload.sub,
      username: payload.username ?? payload.email ?? 'Anonymous',
    };

    return true;
  }
}
