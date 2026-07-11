import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from './access-token.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/register')
  register(@Body() input: RegisterDto) { return this.auth.register(input); }

  @Post('auth/login')
  login(@Body() input: LoginDto) { return this.auth.login(input); }

  @Post('auth/refresh')
  refresh(@Body() input: RefreshDto) { return this.auth.refresh(input); }

  @Post('auth/logout')
  @UseGuards(AccessTokenGuard)
  logout(@Req() request: AuthenticatedRequest) {
    return this.auth.logout(request.auth.sub, request.auth.sessionId);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@Req() request: AuthenticatedRequest) { return this.auth.me(request.auth.sub); }

  @Patch('me/settings')
  @UseGuards(AccessTokenGuard)
  updateSettings(@Req() request: AuthenticatedRequest, @Body() input: UpdateSettingsDto) {
    return this.auth.updateSettings(request.auth.sub, input);
  }
}
