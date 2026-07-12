import type { AiProviderInput, AiProviderResult } from './task-ai.types';

export const AI_PROVIDERS = Symbol('AI_PROVIDERS');
export interface AiProvider { readonly name: string; answer(input: AiProviderInput): Promise<AiProviderResult>; }
