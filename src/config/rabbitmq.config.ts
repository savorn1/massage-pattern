import { registerAs } from '@nestjs/config';
import { DEFAULT_CONFIG } from '../core/common/constants/default-config.constant';

export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || DEFAULT_CONFIG.RABBITMQ.URL,
  queueOptions: DEFAULT_CONFIG.RABBITMQ.QUEUE_OPTIONS,
}));
