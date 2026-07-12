import { IsIn, IsString, Length } from 'class-validator';
export class PaymentWebhookDto { @IsString() @Length(1, 160) eventId!: string; @IsString() @Length(1, 160) externalOrderId!: string; @IsIn(['paid', 'failed']) status!: 'paid' | 'failed'; }
