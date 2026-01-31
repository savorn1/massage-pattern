import { registerAs } from '@nestjs/config';
import { DEFAULT_CONFIG } from '../common/constants/default-config.constant';

export default registerAs('database', () => ({
  mongodb: {
    uri: process.env.MONGODB_URI || DEFAULT_CONFIG.MONGODB.URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
}));
