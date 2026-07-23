import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Text } from '@/ui/hero-runtime';
import { useSubscriptionStore } from '../subscription.store';

const plans = [{ id: 'monthly', label: '月度', price: '¥9.9' }, { id: 'quarterly', label: '季度', price: '¥27.9' }, { id: 'yearly', label: '年度', price: '¥99' }] as const;

export function SubscriptionPanel() {
  const configured = useSubscriptionStore((state) => state.configured);
  const entitlements = useSubscriptionStore((state) => state.entitlements);
  const order = useSubscriptionStore((state) => state.order);
  const loading = useSubscriptionStore((state) => state.loading);
  const error = useSubscriptionStore((state) => state.error);
  const load = useSubscriptionStore((state) => state.load);
  const purchase = useSubscriptionStore((state) => state.purchase);
  const completeTest = useSubscriptionStore((state) => state.completeTest);
  useEffect(() => { if (configured) void load(); }, [configured, load]);

  return <View className="gap-3"><Card><Card.Body className="gap-3">
    <View className="flex-row flex-wrap items-center justify-between gap-2"><Card.Title>LoopTodo VIP</Card.Title><Chip color={entitlements?.vip ? 'success' : 'warning'}>{entitlements?.vip ? '已开通' : '免费版'}</Chip></View>
    <Card.Description>基础自律功能免费；VIP 当前提供更多习惯与家庭管理，其他扩展能力会逐步开放。</Card.Description>
    {loading && !entitlements ? <Text type="body-sm" color="muted">正在加载权益…</Text> : null}
    {entitlements?.subscription ? <Text type="body-sm">{entitlements.subscription.plan} · 到期 {entitlements.subscription.expiresAt.slice(0, 10)}</Text> : <Text type="body-xs" color="muted">免费版最多创建 3 个习惯</Text>}
    <View className="gap-1">
      <Text type="body-sm" weight="semibold">当前已生效权益</Text>
      <Text type="body-xs" color="muted">习惯数量：{entitlements?.habitLimit == null ? '不限' : `免费最多 ${entitlements.habitLimit} 个`}</Text>
      <Text type="body-xs" color="muted">家庭创建/管理：{entitlements?.familyManagement ? '已开通' : '需 VIP'}</Text>
      <Text type="body-xs" color="muted">主题色 / 白噪音 / 海报：内测预留，尚未单独售卖</Text>
    </View>
    {entitlements?.paymentAvailable ? <View className="flex-row flex-wrap gap-2">{plans.map((plan) => <Button key={plan.id} size="sm" variant="secondary" isDisabled={loading} onPress={() => void purchase(plan.id)}>{plan.label} {plan.price}</Button>)}</View> : entitlements ? <Card variant="secondary"><Card.Body className="gap-1"><Text type="body-sm" weight="semibold">内测阶段</Text><Text type="body-xs" color="muted">正式支付尚未配置，当前不提供无效购买按钮。</Text></Card.Body></Card> : null}
    {entitlements?.testPaymentAvailable ? <View className="gap-2"><Text type="body-xs" color="muted">开发环境可创建测试订单，不会产生真实扣款。</Text><View className="flex-row flex-wrap gap-2">{plans.map((plan) => <Button key={plan.id} size="sm" variant="secondary" isDisabled={loading} onPress={() => void purchase(plan.id)}>测试 {plan.label}</Button>)}</View></View> : null}
    {order?.provider === 'test' && order.status === 'pending' ? <View className="gap-2 rounded-panel-inner bg-surface-secondary p-3"><Text type="body-xs">测试支付订单，不会产生真实扣款。</Text><Button size="sm" onPress={() => void completeTest()}>完成测试支付</Button></View> : null}
    {error ? <View className="gap-2"><Text type="body-xs" color="danger">{error}</Text><Button size="sm" variant="secondary" onPress={() => void load()}>重试</Button></View> : null}
  </Card.Body></Card></View>;
}
