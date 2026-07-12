import { IsIn } from 'class-validator'; import type { Plan } from '../subscription.policy';
export class CreateSubscriptionOrderDto { @IsIn(['monthly', 'quarterly', 'yearly']) plan!: Plan; }
