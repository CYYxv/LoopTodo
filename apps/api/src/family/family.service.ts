import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'; import { createHash, randomBytes } from 'node:crypto'; import { Prisma } from '@prisma/client'; import { PrismaService } from '../infrastructure/prisma/prisma.service'; import { RedisService } from '../infrastructure/redis/redis.service'; import { NotificationService } from '../notifications/notification.service'; import { SubscriptionService } from '../subscription/subscription.service'; import { SecurityAuditService } from '../observability/security-audit.service'; import type { AssignFamilyTaskDto } from './dto/family.dto'; import { sanitizeFamilyTaskPatch } from './family.policy';
@Injectable() export class FamilyService { constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly notifications: NotificationService, private readonly subscriptions: SubscriptionService, private readonly security: SecurityAuditService) {}
  async createGroup(userId: string, name: string) { await this.subscriptions.assertEntitled(userId, 'familyManagement'); return this.prisma.$transaction(async (tx) => { const group = await tx.familyGroup.create({ data: { name: name.trim(), createdById: userId } }); await tx.familyMember.create({ data: { familyGroupId: group.id, userId, role: 'parent' } }); return group; }); }
  listGroups(userId: string) { return this.prisma.familyMember.findMany({ where: { userId, leftAt: null }, include: { familyGroup: { include: { members: { where: { leftAt: null }, include: { user: { select: { id: true, nickname: true } } } } } } } }); }
  async createInvite(userId: string, groupId: string, role: 'parent' | 'child') { await this.requireParent(userId, groupId); await this.requireGroupEntitlement(groupId); const code = randomBytes(8).toString('hex').toUpperCase(); await this.prisma.familyInvite.create({ data: { familyGroupId: groupId, role, codeHash: hash(code), expiresAt: new Date(Date.now() + 7 * 86_400_000) } }); return { code, expiresAt: new Date(Date.now() + 7 * 86_400_000) }; }
  async join(userId: string, code: string) { const redis = await this.redis.getClient(); const attempts = await redis.incr(`family:join:${userId}`); if (attempts === 1) await redis.expire(`family:join:${userId}`, 300); if (attempts > 10) throw new ForbiddenException({ code: 'FAMILY_INVITE_RATE_LIMITED', message: '邀请码尝试过多，请稍后再试' }); const invite = await this.prisma.familyInvite.findUnique({ where: { codeHash: hash(code.trim().toUpperCase()) } }); if (!invite || invite.usedAt || invite.expiresAt <= new Date()) throw new NotFoundException({ code: 'FAMILY_INVITE_INVALID', message: '家庭邀请码无效或已过期' }); await this.requireGroupEntitlement(invite.familyGroupId);
    return this.prisma.$transaction(async (tx) => { const claimed = await tx.familyInvite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: new Date(), usedById: userId } }); if (!claimed.count) throw new ConflictException({ code: 'FAMILY_INVITE_USED', message: '邀请码已使用' }); return tx.familyMember.upsert({ where: { familyGroupId_userId: { familyGroupId: invite.familyGroupId, userId } }, update: { role: invite.role, leftAt: null, joinedAt: new Date() }, create: { familyGroupId: invite.familyGroupId, userId, role: invite.role } }); }); }
  async assignTask(userId: string, groupId: string, input: AssignFamilyTaskDto) { const parent = await this.requireParent(userId, groupId); await this.requireGroupEntitlement(groupId); const child = await this.prisma.familyMember.findFirst({ where: { familyGroupId: groupId, userId: input.childUserId, role: 'child', leftAt: null } }); if (!child) throw new NotFoundException({ code: 'FAMILY_CHILD_NOT_FOUND', message: '孩子不在该家庭组' }); if (input.taskType === 'goal' && (input.timerMode !== 'countdown' || !input.deadlineAt || !input.targetAmount || !input.targetUnit?.trim())) throw new BadRequestException({ code: 'GOAL_FIELDS_REQUIRED', message: '定目标任务需要倒计时、截止日期、目标量和单位' }); if (input.isTodayRequired && !input.triggerTime) throw new BadRequestException({ code: 'FORCED_TRIGGER_TIME_REQUIRED', message: '今日必须任务需要触发时间' });
    const result = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          userId: child.userId,
          title: input.title.trim(),
          taskType: input.taskType,
          timerMode: input.timerMode,
          estimatedMinutes: input.estimatedMinutes,
          restMinutes: input.restMinutes,
          deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
          targetAmount: input.targetAmount,
          targetUnit: input.targetUnit?.trim(),
          isTodayRequired: input.isTodayRequired,
          forcedTriggerTime: input.isTodayRequired ? input.triggerTime : null,
          createdByFamilyMemberId: parent.id,
        },
      });
      const assignment = await tx.familyTaskAssignment.create({
        data: { familyGroupId: groupId, taskId: task.id, parentMemberId: parent.id, childMemberId: child.id },
      });
      if (input.isTodayRequired && input.triggerTime) {
        await tx.forcedLockRule.create({ data: { userId: child.userId, taskId: task.id, triggerTime: input.triggerTime } });
      }
      return { task, assignment };
    });
    await this.notifications.enqueue({
      userId: child.userId,
      type: 'family_task_assigned',
      title: '新的家庭任务',
      body: `家长布置了任务「${input.title.trim()}」`,
      data: { taskId: result.task.id, assignmentId: result.assignment.id, groupId },
      dedupeKey: `family-task-assigned:${result.assignment.id}`,
      scheduledAt: new Date(),
    });
    return result;
  }
  async requestChange(userId: string, assignmentId: string, requestType: 'update' | 'delete', reason: string, proposedPatch?: Record<string, unknown>) {
    const assignment = await this.prisma.familyTaskAssignment.findFirst({
      where: { id: assignmentId, childMember: { userId, leftAt: null }, status: 'active' },
      include: { childMember: { include: { user: { select: { nickname: true } } } }, task: { select: { title: true } } },
    });
    if (!assignment) throw new NotFoundException({ code: 'FAMILY_ASSIGNMENT_NOT_FOUND', message: '家庭任务不存在' });
    const patch = sanitizeFamilyTaskPatch(proposedPatch);
    if (requestType === 'update' && !Object.keys(patch).length) throw new BadRequestException({ code: 'EMPTY_TASK_PATCH', message: '修改申请没有有效字段' });
    const created = await this.prisma.taskChangeRequest.create({
      data: {
        assignmentId,
        childMemberId: assignment.childMemberId,
        requestType,
        reason: reason.trim(),
        proposedPatch: requestType === 'update' ? patch as Prisma.InputJsonObject : undefined,
      },
    });
    const parents = await this.prisma.familyMember.findMany({
      where: { familyGroupId: assignment.familyGroupId, role: 'parent', leftAt: null },
      select: { userId: true },
    });
    const childName = assignment.childMember.user.nickname;
    const taskTitle = assignment.task.title;
    await Promise.all(parents.map((parent) => this.notifications.enqueue({
      userId: parent.userId,
      type: 'family_change_request',
      title: '家庭任务修改申请',
      body: `${childName} 申请${requestType === 'delete' ? '删除' : '修改'}「${taskTitle}」`,
      data: { requestId: created.id, assignmentId, childUserId: userId, requestType },
      dedupeKey: `family-change-request:${created.id}`,
      scheduledAt: new Date(),
    })));
    return created;
  }
  async reviewChange(userId: string, requestId: string, decision: 'approved' | 'rejected') {
    const request = await this.prisma.taskChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        assignment: {
          include: {
            childMember: { include: { user: { select: { id: true, nickname: true } } } },
            task: { select: { title: true } },
          },
        },
      },
    });
    if (!request || request.status !== 'pending') throw new NotFoundException({ code: 'CHANGE_REQUEST_NOT_FOUND', message: '修改申请不存在或已处理' });
    await this.requireParent(userId, request.assignment.familyGroupId);
    await this.requireGroupEntitlement(request.assignment.familyGroupId);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (decision === 'approved') {
        const task = await tx.task.findUniqueOrThrow({ where: { id: request.assignment.taskId } });
        if (task.activeSessionId) throw new ConflictException({ code: 'FAMILY_TASK_ACTIVE', message: '任务进行中，暂时不能批准修改或删除' });
        if (request.requestType === 'delete') {
          await tx.task.update({ where: { id: request.assignment.taskId }, data: { status: 'archived', version: { increment: 1 } } });
          await tx.familyTaskAssignment.update({ where: { id: request.assignmentId }, data: { status: 'cancelled' } });
        } else {
          await tx.task.update({ where: { id: request.assignment.taskId }, data: { ...taskUpdateData(request.proposedPatch as Record<string, unknown>, task), version: { increment: 1 } } });
        }
      }
      return tx.taskChangeRequest.update({ where: { id: request.id }, data: { status: decision, reviewedByUserId: userId, reviewedAt: new Date() } });
    });
    const childUserId = request.assignment.childMember.user.id;
    const taskTitle = request.assignment.task.title;
    await this.notifications.enqueue({
      userId: childUserId,
      type: 'family_change_result',
      title: decision === 'approved' ? '修改申请已批准' : '修改申请已拒绝',
      body: decision === 'approved'
        ? `家长已批准你对「${taskTitle}」的${request.requestType === 'delete' ? '删除' : '修改'}申请`
        : `家长已拒绝你对「${taskTitle}」的申请`,
      data: { requestId: request.id, decision, assignmentId: request.assignmentId },
      dedupeKey: `family-change-result:${request.id}:${decision}`,
      scheduledAt: new Date(),
    });
    return updated;
  } else { await tx.task.update({ where: { id: request.assignment.taskId }, data: { ...taskUpdateData(request.proposedPatch as Record<string, unknown>, task), version: { increment: 1 } } }); } } return tx.taskChangeRequest.update({ where: { id: request.id }, data: { status: decision, reviewedByUserId: userId, reviewedAt: new Date() } }); }); }
  async status(userId: string, childUserId: string) {
    const relation = await this.prisma.familyMember.findFirst({
      where: {
        userId,
        role: 'parent',
        leftAt: null,
        familyGroup: { members: { some: { userId: childUserId, role: 'child', leftAt: null } } },
      },
    });
    if (!relation) {
      await this.security.record({
        actorId: userId,
        category: 'authorization',
        action: 'family_status_read',
        outcome: 'denied',
        targetType: 'user',
        targetId: childUserId,
      });
      throw new ForbiddenException({ code: 'FAMILY_STATUS_FORBIDDEN', message: '无权查看该用户家庭状态' });
    }

    const [tasks, sessions, assignments] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId: childUserId, status: { not: 'archived' } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true, title: true, status: true, taskType: true, isTodayRequired: true,
          forcedTriggerTime: true, estimatedMinutes: true, completedAmount: true, targetAmount: true, targetUnit: true, updatedAt: true,
        },
      }),
      this.prisma.focusSession.findMany({
        where: { userId: childUserId },
        orderBy: { startedAt: 'desc' },
        take: 30,
        select: {
          id: true, taskId: true, mode: true, outcome: true, startedAt: true, endedAt: true,
          actualMinutes: true, failureReasonType: true, failureReasonText: true, completionNote: true,
        },
      }),
      this.prisma.familyTaskAssignment.findMany({
        where: { childMember: { userId: childUserId, leftAt: null }, status: 'active' },
        include: { task: { select: { id: true, title: true, status: true, isTodayRequired: true, forcedTriggerTime: true } } },
        take: 50,
      }),
    ]);

    const activeSession = sessions.find((session) => !session.endedAt) ?? null;
    const failures = sessions.filter((session) => session.outcome && session.outcome !== 'completed').slice(0, 10);
    const anomalyEvents = await this.prisma.notificationEvent.findMany({
      where: { userId, type: 'family_anomaly' },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    const recentAnomalies = anomalyEvents
      .map((event) => {
        const data = (event.data && typeof event.data === 'object' && !Array.isArray(event.data))
          ? event.data as Record<string, unknown>
          : {};
        return {
          id: event.id,
          type: typeof data.anomalyType === 'string' ? data.anomalyType : 'family_anomaly',
          body: event.body,
          taskId: typeof data.taskId === 'string' ? data.taskId : null,
          childUserId: typeof data.childUserId === 'string' ? data.childUserId : null,
          createdAt: event.createdAt,
        };
      })
      .filter((item) => item.childUserId === childUserId)
      .slice(0, 10);
    return {
      childUserId,
      summary: {
        taskCount: tasks.length,
        activeFamilyTasks: assignments.length,
        sessionCount: sessions.length,
        currentState: activeSession ? (activeSession.mode === 'lock' ? '锁机中' : '专注中') : '空闲',
      },
      tasks,
      familyAssignments: assignments.map((item) => ({
        id: item.id,
        taskId: item.task.id,
        title: item.task.title,
        status: item.task.status,
        isTodayRequired: item.task.isTodayRequired,
        triggerTime: item.task.forcedTriggerTime,
      })),
      sessions,
      failures: failures.map((session) => ({
        id: session.id,
        taskId: session.taskId,
        outcome: session.outcome,
        reason: session.failureReasonText || session.failureReasonType || '未填写',
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        actualMinutes: session.actualMinutes,
      })),
      recentAnomalies,
      activeSession,
    };
  }

  /**
   * 退出后立即失去成员与状态访问；服务端仅保留审计，不对前成员开放历史查询。
   */
  async leave(userId: string, groupId: string) {
    const result = await this.prisma.familyMember.updateMany({
      where: { familyGroupId: groupId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });
    if (!result.count) {
      throw new NotFoundException({ code: 'FAMILY_MEMBERSHIP_NOT_FOUND', message: '家庭成员关系不存在' });
    }
    try {
      await this.security.record({
        actorId: userId,
        category: 'privacy',
        action: 'member_leave',
        outcome: 'allowed',
        targetType: 'family_group',
        targetId: groupId,
      });
    } catch {
      // membership already left; audit must not roll back leave
    }
    return { left: true };
  }
  listRequests(userId: string, groupId: string) { return this.requireParent(userId, groupId).then(() => this.prisma.taskChangeRequest.findMany({ where: { assignment: { familyGroupId: groupId } }, include: { assignment: { include: { task: true } }, childMember: { include: { user: { select: { nickname: true } } } } }, orderBy: { createdAt: 'desc' } })); }
  listAssignments(userId: string) { return this.prisma.familyTaskAssignment.findMany({ where: { childMember: { userId, leftAt: null }, status: 'active' }, include: { task: true, changeRequests: { where: { status: 'pending' }, orderBy: { createdAt: 'desc' } }, parentMember: { include: { user: { select: { nickname: true } } } } }, orderBy: { createdAt: 'desc' } }); }
  async handleSessionFinished(userId: string, session: { id: string; outcome: string | null; taskId: string }) { if (session.outcome !== 'emergency_exit') return; const parents = await this.prisma.familyMember.findMany({ where: { role: 'parent', leftAt: null, familyGroup: { members: { some: { userId, role: 'child', leftAt: null } } } }, select: { userId: true } }); await Promise.all(parents.map((parent) => this.notifications.enqueue({ userId: parent.userId, type: 'family_anomaly', title: '家庭异常提醒', body: '孩子提前退出了锁机任务', data: { childUserId: userId, taskId: session.taskId }, dedupeKey: `family-emergency:${parent.userId}:${session.id}`, scheduledAt: new Date() }))); }
  async reportAnomaly(userId: string, type: 'permission_disabled' | 'reboot_detected' | 'task_overdue' | 'forced_trigger_missed', taskId?: string) {
    const parents = await this.prisma.familyMember.findMany({
      where: { role: 'parent', leftAt: null, familyGroup: { members: { some: { userId, role: 'child', leftAt: null } } } },
      select: { userId: true },
    });
    const body =
      type === 'permission_disabled' ? '孩子关闭了必要权限'
      : type === 'reboot_detected' ? '孩子设备在约束期间重启'
      : type === 'forced_trigger_missed' ? '孩子未按时开始强制触发任务'
      : '孩子的家庭任务已逾期'; await Promise.all(parents.map((parent) => this.notifications.enqueue({ userId: parent.userId, type: 'family_anomaly', title: '家庭异常提醒', body, data: { childUserId: userId, taskId: taskId ?? '', anomalyType: type }, dedupeKey: `family-${type}:${parent.userId}:${userId}:${taskId ?? 'device'}:${new Date().toISOString().slice(0, 10)}`, scheduledAt: new Date() }))); return { notified: parents.length }; }
  private async requireParent(userId: string, groupId: string) { const member = await this.prisma.familyMember.findFirst({ where: { familyGroupId: groupId, userId, role: 'parent', leftAt: null } }); if (!member) { await this.security.record({ actorId: userId, category: 'authorization', action: 'family_parent_action', outcome: 'denied', targetType: 'family_group', targetId: groupId }); throw new ForbiddenException({ code: 'FAMILY_PARENT_REQUIRED', message: '需要家庭家长权限' }); } return member; }
  private async requireGroupEntitlement(groupId: string) { const active = await this.prisma.subscription.findFirst({ where: { expiresAt: { gt: new Date() }, user: { familyMemberships: { some: { familyGroupId: groupId, leftAt: null } } } } }); if (!active) throw new ForbiddenException({ code: 'FAMILY_VIP_REQUIRED', message: '家庭组中至少一名成员需要有效 VIP' }); }
}
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function taskUpdateData(value: Record<string, unknown>, current: { isTodayRequired: boolean; forcedTriggerTime: string | null }): Prisma.TaskUpdateInput {
  const patch = sanitizeFamilyTaskPatch(value);
  const data: Prisma.TaskUpdateInput = {};
  if (typeof patch.title === 'string' && patch.title.trim().length && patch.title.length <= 240) data.title = patch.title.trim(); else if ('title' in patch) throw invalidPatch();
  if (typeof patch.estimatedMinutes === 'number' && Number.isInteger(patch.estimatedMinutes) && patch.estimatedMinutes >= 1 && patch.estimatedMinutes <= 180) data.estimatedMinutes = patch.estimatedMinutes; else if ('estimatedMinutes' in patch) throw invalidPatch();
  if (typeof patch.restMinutes === 'number' && Number.isInteger(patch.restMinutes) && patch.restMinutes >= 0 && patch.restMinutes <= 180) data.restMinutes = patch.restMinutes; else if ('restMinutes' in patch) throw invalidPatch();
  if (typeof patch.deadlineAt === 'string' || patch.deadlineAt === null) { const date = patch.deadlineAt ? new Date(patch.deadlineAt) : null; if (date && Number.isNaN(date.getTime())) throw invalidPatch(); data.deadlineAt = date; }
  if ((typeof patch.targetAmount === 'number' && patch.targetAmount > 0) || patch.targetAmount === null) data.targetAmount = patch.targetAmount; else if ('targetAmount' in patch) throw invalidPatch();
  if ((typeof patch.targetUnit === 'string' && patch.targetUnit.length > 0 && patch.targetUnit.length <= 40) || patch.targetUnit === null) data.targetUnit = patch.targetUnit; else if ('targetUnit' in patch) throw invalidPatch();
  if (typeof patch.isTodayRequired === 'boolean') data.isTodayRequired = patch.isTodayRequired; else if ('isTodayRequired' in patch) throw invalidPatch();
  if ('triggerTime' in patch && (typeof patch.triggerTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.triggerTime))) throw invalidPatch();
  const required = typeof patch.isTodayRequired === 'boolean' ? patch.isTodayRequired : current.isTodayRequired;
  const triggerTime = required ? typeof patch.triggerTime === 'string' ? patch.triggerTime : current.forcedTriggerTime : null;
  if (required && !triggerTime) throw new BadRequestException({ code: 'FORCED_TRIGGER_TIME_REQUIRED', message: '今日必须任务需要触发时间' });
  if ('isTodayRequired' in patch || 'triggerTime' in patch) data.forcedTriggerTime = triggerTime;
  return data;
}
function invalidPatch() { return new BadRequestException({ code: 'INVALID_FAMILY_TASK_PATCH', message: '修改申请包含无效任务字段' }); }
