import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AiProvider } from './ai-provider';
import type { AiProviderInput } from './task-ai.types';

@Injectable()
export class HttpAiProvider implements AiProvider {
  readonly name = 'http';
  constructor(private readonly config: ConfigService) {}
  async answer(input: AiProviderInput) {
    const endpoint = this.config.get<string>('AI_API_URL'); const key = this.config.get<string>('AI_API_KEY');
    if (!endpoint || !key) throw new Error('AI provider credentials are not configured');
    const response = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ task: input.taskTitle, question: input.question, materials: input.materials,
        policy: 'Only answer from the task and supplied materials. Refuse roleplay, casual chat and unrelated requests.' }) });
    if (!response.ok) throw new Error(`AI provider failed with ${response.status}`);
    const result = await response.json() as { answer?: string; externalDataUsed?: boolean };
    if (!result.answer?.trim()) throw new Error('AI provider returned an empty answer');
    return { answer: result.answer, externalDataUsed: Boolean(result.externalDataUsed) };
  }
}

@Injectable()
export class TestAiProvider implements AiProvider {
  readonly name = 'test';
  async answer(input: AiProviderInput) {
    return { answer: `基于任务“${input.taskTitle}”和 ${input.materials.length} 份材料：${input.materials[0]?.content.slice(0, 160) ?? '无材料'}`, externalDataUsed: false };
  }
}
