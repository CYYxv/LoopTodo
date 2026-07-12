export type AiMaterial = { id: string; taskId: string; title: string; content: string; contentHash: string; createdAt: string };
export type AiAnswer = { answer: string; externalDataUsed: boolean; provider: string; warning: string | null };
