import { Injectable } from '@nestjs/common';

import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { TaskAiRepository } from './task-ai.repository';

@Injectable()
export class PrismaTaskAiRepository implements TaskAiRepository {
  constructor(private readonly prisma: PrismaService) {}
  getTask(userId: string, taskId: string) { return this.prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true, title: true, activeSessionId: true } }); }
  async createMaterial(input: Parameters<TaskAiRepository['createMaterial']>[0]) {
    return this.prisma.$transaction(async (transaction) => {
      const material = await transaction.aiMaterial.create({ data: input });
      await transaction.resourcePass.create({ data: { userId: input.userId, taskId: input.taskId, resourceType: 'ai_material', resourceValue: material.id,
        trustWeight: 100, addedDuringFocus: false, auditReason: 'user_added_before_focus' } });
      return material;
    });
  }
  listMaterials(userId: string, taskId: string, ids?: string[]) {
    return this.prisma.aiMaterial.findMany({ where: { userId, taskId, ...(ids?.length ? { id: { in: ids } } : {}) }, orderBy: { createdAt: 'asc' } });
  }
  async recordAudit(input: Parameters<TaskAiRepository['recordAudit']>[0]) { await this.prisma.aiAudit.create({ data: input }); }
}
