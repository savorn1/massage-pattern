import { registerAs } from '@nestjs/config';
import { DEFAULT_CONFIG } from '../common/constants/default-config.constant';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || DEFAULT_CONFIG.REDIS.HOST,
  port: parseInt(
    process.env.REDIS_PORT || String(DEFAULT_CONFIG.REDIS.PORT),
    10,
  ),
  retryDelayMax: DEFAULT_CONFIG.REDIS.RETRY_DELAY_MAX,
  retryAttempts: DEFAULT_CONFIG.REDIS.RETRY_ATTEMPTS,
}));
