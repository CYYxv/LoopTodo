import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const response = exception instanceof HttpException ? exception.getResponse() : null;
    const body = typeof response === 'object' && response && 'code' in response
      ? response as { code: string; message: string }
      : { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED', message: status === 500 ? '服务器内部错误' : exception instanceof Error ? exception.message : '请求失败' };
    void reply.status(status).send({ data: null, error: body });
  }
}
