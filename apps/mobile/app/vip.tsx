import { useRouter } from 'expo-router';
import { SubscriptionPanel } from '@/modules/subscription/components/SubscriptionPanel';
import { Button } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';
export default function VipRoute() { const router = useRouter(); return <Screen><PageHeader title="LoopTodo VIP" description="查看订阅状态与扩展权益。" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} /><SubscriptionPanel /></Screen>; }
