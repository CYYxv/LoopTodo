export const reactionEmojis = ['💪', '🔥', '👏', '🌱', '🏁'] as const;
export function socialPairKey(first: string, second: string) { return [first, second].sort().join(':'); }
export function isReactionEmoji(value: string): value is typeof reactionEmojis[number] { return reactionEmojis.includes(value as typeof reactionEmojis[number]); }
