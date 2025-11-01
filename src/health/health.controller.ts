import { Controller, Get } from '@nestjs/common';
import { HealthResponse } from '../core/interfaces/api-response.interface';

/**
 * Health check controller for monitoring service health
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'up',
          message: 'API is running',
        },
      },
    };
  }

  @Get('ready')
  readiness(): HealthResponse {
    return {
      success: true,
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  liveness(): HealthResponse {
    return {
      success: true,
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }
}
