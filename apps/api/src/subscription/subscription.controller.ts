import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common'; import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/access-token.guard'; import { CreateSubscriptionOrderDto } from './dto/create-subscription-order.dto'; import { PaymentWebhookDto } from './dto/payment-webhook.dto'; import { SubscriptionService } from './subscription.service';
@Controller('subscription') export class SubscriptionController { constructor(private readonly service: SubscriptionService) {}
  @Get('entitlements') @UseGuards(AccessTokenGuard) entitlements(@Req() request: AuthenticatedRequest) { return this.service.entitlements(request.auth.sub); }
  @Post('orders') @UseGuards(AccessTokenGuard) create(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() input: CreateSubscriptionOrderDto) { return this.service.createOrder(request.auth.sub, input.plan, key); }
  @Post('test-orders/:id/complete') @UseGuards(AccessTokenGuard) complete(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.service.completeTestOrder(request.auth.sub, id); }
  @Post('webhook') webhook(@Headers('x-payment-signature') signature: string, @Body() input: PaymentWebhookDto) { return this.service.handleWebhook(input, signature); }
}
