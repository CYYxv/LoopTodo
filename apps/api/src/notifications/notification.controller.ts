import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/access-token.guard';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}
  @Post('devices') register(@Req() request: AuthenticatedRequest, @Body() input: RegisterDeviceDto) { return this.service.registerDevice(request.auth.sub, input); }
  @Post('test') test(@Req() request: AuthenticatedRequest) {
    const now = new Date();
    return this.service.enqueue({ userId: request.auth.sub, type: 'focus_complete', title: 'LoopTodo 测试通知',
      body: '服务端通知投递链路工作正常', data: {}, dedupeKey: `manual-test-${request.auth.sub}-${now.getTime()}`, scheduledAt: now });
  }
}
