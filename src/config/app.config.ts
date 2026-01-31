import { registerAs } from '@nestjs/config';
import { DEFAULT_CONFIG } from '../common/constants/default-config.constant';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || String(DEFAULT_CONFIG.PORT), 10),
  env: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || DEFAULT_CONFIG.WEBSOCKET.CORS_ORIGIN,
}));
