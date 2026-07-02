import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/auth.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
