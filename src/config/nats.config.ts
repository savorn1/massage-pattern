import { registerAs } from '@nestjs/config';
import { DEFAULT_CONFIG } from '../common/constants/default-config.constant';

export default registerAs('nats', () => ({
  url: process.env.NATS_URL || DEFAULT_CONFIG.NATS.URL,
  requestTimeout: DEFAULT_CONFIG.NATS.REQUEST_TIMEOUT,
}));
