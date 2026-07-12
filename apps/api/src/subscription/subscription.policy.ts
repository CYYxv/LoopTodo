export const planPrices = { monthly: 990, quarterly: 2790, yearly: 9900 } as const;
export type Plan = keyof typeof planPrices;
export function extendSubscription(from: Date, plan: Plan) { const result = new Date(from); result.setUTCMonth(result.getUTCMonth() + (plan === 'monthly' ? 1 : plan === 'quarterly' ? 3 : 12)); return result; }
export function entitlementView(active: boolean) { return { vip: active, habitLimit: active ? null : 3, themes: active, backgrounds: active, focusPosters: active, whiteNoise: active, taskAi: active, mcp: active, familyManagement: active }; }
