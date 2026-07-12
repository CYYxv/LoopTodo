export type AiMaterialView = { id: string; taskId: string; title: string; content: string; contentHash: string; createdAt: Date };
export type AiProviderInput = { taskTitle: string; question: string; materials: Array<{ title: string; content: string }> };
export type AiProviderResult = { answer: string; externalDataUsed: boolean };
export type AiAnswer = AiProviderResult & { provider: string; warning: string | null };
