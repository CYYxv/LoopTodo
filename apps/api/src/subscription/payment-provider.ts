import type { Plan } from './subscription.policy';
export type PaymentOrderInput = { orderId: string; userId: string; plan: Plan; amountCents: number; currency: string };
export interface PaymentProviderAdapter { readonly name: 'http' | 'test'; createOrder(input: PaymentOrderInput): Promise<{ externalOrderId: string; checkoutUrl: string | null }> }
export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
