import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'feature_flag';

/**
 * Protect a route behind a feature flag.
 * If the flag is disabled, the request is rejected with 403.
 *
 * @example
 * @RequireFlag('beta-export')
 * @Get('export')
 * exportToCsv() { ... }
 */
export const RequireFlag = (flagKey: string) => SetMetadata(FEATURE_FLAG_KEY, flagKey);
