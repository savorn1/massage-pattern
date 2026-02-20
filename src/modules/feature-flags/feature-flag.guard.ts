import {
  CanActivate, ExecutionContext, Injectable,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from './feature-flag.decorator';
import { FeatureFlagService } from './feature-flag.service';

/**
 * Guard that blocks access to a route when a feature flag is disabled.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, FeatureFlagGuard)
 *   @RequireFlag('beta-export')
 *   @Get('export')
 *   exportToCsv() { ... }
 *
 * The guard reads the userId from request.user (set by JwtAuthGuard) to
 * support percentage-rollout and user-targeted flags.
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly logger = new Logger(FeatureFlagGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly flagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.get<string>(FEATURE_FLAG_KEY, context.getHandler());

    // No @RequireFlag decorator — allow through
    if (!flagKey) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;

    const result = await this.flagService.evaluate(flagKey, userId);

    if (!result.enabled) {
      this.logger.warn(`[FF] Access denied — flag "${flagKey}" disabled (${result.reason}) for user ${userId ?? 'anonymous'}`);
      throw new ForbiddenException(
        `Feature "${flagKey}" is not available. Reason: ${result.reason}`,
      );
    }

    return true;
  }
}
