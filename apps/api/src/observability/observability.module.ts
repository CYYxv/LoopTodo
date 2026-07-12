import { Global, Module } from '@nestjs/common';

import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { SecurityAuditService } from './security-audit.service';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';

@Global()
@Module({ imports: [PrismaModule], providers: [RequestLoggingInterceptor, SecurityAuditService], exports: [RequestLoggingInterceptor, SecurityAuditService] })
export class ObservabilityModule {}
