import { registerAs } from '@nestjs/config';
import { DEFAULT_CONFIG } from '../core/common/constants/default-config.constant';

export default registerAs('websocket', () => ({
  corsOrigin:
    process.env.WS_CORS_ORIGIN || DEFAULT_CONFIG.WEBSOCKET.CORS_ORIGIN,
  reconnectionTimeout: parseInt(
    process.env.WS_RECONNECTION_TIMEOUT ||
      String(DEFAULT_CONFIG.WEBSOCKET.RECONNECTION_TIMEOUT),
    10,
  ),
  maxMessageLength: parseInt(process.env.WS_MAX_MESSAGE_LENGTH || '10000', 10),
  tokenSecret:
    process.env.WS_TOKEN_SECRET ||
    'your-secure-websocket-token-secret-change-in-production',
}));
