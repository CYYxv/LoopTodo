import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { TokenService } from './token.service';
import type { TokenClaims } from './auth.types';

export type AuthenticatedRequest = FastifyRequest & { auth: TokenClaims };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) throw unauthorized();
    try {
      request.auth = await this.tokens.verifyAccess(token);
      return true;
    } catch {
      throw unauthorized();
    }
  }
}

function unauthorized() {
  return new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN', message: '访问凭证无效或已失效' });
}
