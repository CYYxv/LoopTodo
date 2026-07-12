import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

import { ApiError } from '../common/api-error';
import { AI_PROVIDERS, type AiProvider } from './ai-provider';
import { TASK_AI_REPOSITORY, type TaskAiRepository } from './task-ai.repository';
import { SubscriptionService } from '../subscription/subscription.service';
import { SecurityAuditService } from '../observability/security-audit.service';

@Injectable()
export class TaskAiService {
  private readonly providers: Map<string, AiProvider>;
  constructor(@Inject(TASK_AI_REPOSITORY) private readonly repository: TaskAiRepository,
    @Inject(AI_PROVIDERS) providers: AiProvider[], private readonly config: ConfigService, private readonly subscriptions: SubscriptionService, private readonly security: SecurityAuditService) {
    this.providers = new Map(providers.map((provider) => [provider.name, provider]));
  }
  async createMaterial(userId: string, taskId: string, input: { title: string; content: string }) {
    const task = await this.repository.getTask(userId, taskId); if (!task) throw notFound();
    if (task.activeSessionId) throw new ApiError('RESOURCE_PASS_LOCKED', '专注进行中不能新增 AI 材料', HttpStatus.CONFLICT);
    return this.repository.createMaterial({ userId, taskId, title: input.title.trim(), content: input.content.trim(), contentHash: hash(input.content.trim()) });
  }
  async listMaterials(userId: string, taskId: string) { if (!(await this.repository.getTask(userId, taskId))) throw notFound(); return this.repository.listMaterials(userId, taskId); }
  async ask(userId: string, taskId: string, question: string, materialIds: string[]) {
    await this.subscriptions.assertEntitled(userId, 'taskAi');
    const task = await this.repository.getTask(userId, taskId); if (!task) throw notFound();
    const blocked = blockedReason(question); const questionHash = hash(question.trim());
    const providerName = this.config.get<string>('AI_PROVIDER') ?? 'http';
    if (blocked) {
      await this.repository.recordAudit({ userId, taskId, questionHash, materialIds, provider: providerName, externalDataUsed: false, blocked: true, blockReason: blocked });
      await this.security.record({ actorId: userId, category: 'ai', action: 'task_ai_request', outcome: 'blocked', targetType: 'task', targetId: taskId, metadata: { reason: blocked, provider: providerName, materialCount: materialIds.length, questionHash } });
      throw new ApiError('AI_SCOPE_VIOLATION', '任务型 AI 只能回答与当前任务和材料直接相关的问题', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const materials = await this.repository.listMaterials(userId, taskId, materialIds);
    if (!materialIds.length || materials.length !== materialIds.length) throw new ApiError('AI_MATERIAL_REQUIRED', '请选择属于当前任务的 AI 材料', HttpStatus.BAD_REQUEST);
    if (materials.reduce((total, material) => total + material.content.length, 0) > 100_000) throw new ApiError('AI_MATERIAL_TOO_LARGE', '单次问答材料总量不能超过 100000 字符', HttpStatus.PAYLOAD_TOO_LARGE);
    if (providerName === 'test' && this.config.get<string>('NODE_ENV') === 'production') throw new ApiError('AI_PROVIDER_UNAVAILABLE', '生产环境不能使用 test AI provider', HttpStatus.SERVICE_UNAVAILABLE);
    const provider = this.providers.get(providerName); if (!provider) throw new ApiError('AI_PROVIDER_UNAVAILABLE', 'AI provider 未配置', HttpStatus.SERVICE_UNAVAILABLE);
    let result;
    try { result = await provider.answer({ taskTitle: task.title, question: question.trim(), materials: materials.map(({ title, content }) => ({ title, content })) }); }
    catch (error) {
      await this.repository.recordAudit({ userId, taskId, questionHash, materialIds, provider: provider.name,
        externalDataUsed: false, blocked: true, blockReason: 'provider_error' });
      await this.security.record({ actorId: userId, category: 'ai', action: 'task_ai_provider', outcome: 'failed', targetType: 'task', targetId: taskId, metadata: { provider: provider.name, materialCount: materialIds.length, questionHash } });
      throw error;
    }
    await this.repository.recordAudit({ userId, taskId, questionHash, materialIds, provider: provider.name,
      externalDataUsed: result.externalDataUsed, blocked: false, blockReason: null });
    return { ...result, provider: provider.name, warning: result.externalDataUsed ? '回答使用了材料之外的外部数据，请核验来源' : null };
  }
}

function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function blockedReason(question: string) {
  const value = question.toLowerCase();
  const rules: Array<[RegExp, string]> = [[/忽略(之前|以上).*指令|ignore (all )?(previous|above)/i, 'prompt_injection'],
    [/角色扮演|role.?play|扮演.{0,8}(恋人|游戏|角色)/i, 'roleplay'], [/闲聊|讲.{0,4}笑话|tell me a joke|写.{0,4}(小说|故事)/i, 'casual_chat']];
  return rules.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}
function notFound() { return new ApiError('TASK_NOT_FOUND', '任务不存在', HttpStatus.NOT_FOUND); }
