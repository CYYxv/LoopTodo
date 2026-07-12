import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { catchError, tap, throwError, type Observable } from 'rxjs';

import type { AuthenticatedRequest } from '../auth/access-token.guard';
import { runWithRequestContext } from './request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const providedId = headerValue(request.headers['x-request-id']);
    const requestId = providedId && /^[A-Za-z0-9._-]{8,128}$/.test(providedId) ? providedId : randomUUID();
    const startedAt = Date.now();
    reply.header('x-request-id', requestId);

    return runWithRequestContext(requestId, () => next.handle().pipe(
      tap(() => this.write('completed', request, reply.statusCode, requestId, startedAt)),
      catchError((error) => {
        this.write('failed', request, error?.status ?? 500, requestId, startedAt);
        return throwError(() => error);
      }),
    ));
  }

  private write(outcome: string, request: FastifyRequest, statusCode: number, requestId: string, startedAt: number) {
    const auth = (request as Partial<AuthenticatedRequest>).auth;
    this.logger.log(JSON.stringify({
      event: 'http_request', requestId, method: request.method, path: request.url.split('?')[0], statusCode,
      durationMs: Date.now() - startedAt, outcome, userId: auth?.sub ?? null,
    }));
  }
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

