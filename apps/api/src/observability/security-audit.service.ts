import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { currentRequestId } from './request-context';
import { redactSecurityMetadata } from './security-redaction';

export type SecurityEventInput = {
  actorId?: string | null;
  category: 'authorization' | 'payment' | 'privacy' | 'ai';
  action: string;
  outcome: 'allowed' | 'denied' | 'blocked' | 'failed';
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class SecurityAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: SecurityEventInput) {
    const metadata = redactSecurityMetadata(input.metadata ?? {}) as Prisma.InputJsonValue;
    return this.prisma.securityEvent.create({
      data: {
        actorId: input.actorId ?? null,
        category: input.category,
        action: input.action,
        outcome: input.outcome,
        targetType: input.targetType ?? null,
        targetHash: input.targetId ? createHash('sha256').update(input.targetId).digest('hex') : null,
        requestId: currentRequestId(),
        metadata,
      },
    });
  }
}

