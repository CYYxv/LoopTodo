export const reactionEmojis = ['💪', '🔥', '👏', '🌱', '🏁'] as const;

export function socialPairKey(first: string, second: string) {
  return [first, second].sort().join(':');
}

export function isReactionEmoji(value: string): value is typeof reactionEmojis[number] {
  return reactionEmojis.includes(value as typeof reactionEmojis[number]);
}

/** PK uses mode-weighted competitive minutes (whitelist lowest, lock highest). */
export function competitiveFocusMinutes(events: Array<{ durationMinutes: number; trustLevel: string }>) {
  return events.reduce((sum, event) => {
    const coefficient = event.trustLevel === 'high' ? 1.5 : event.trustLevel === 'normal' ? 1.25 : 1;
    return sum + Math.round(Math.max(0, event.durationMinutes) * coefficient);
  }, 0);
}
