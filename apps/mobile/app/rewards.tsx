import { useRouter } from 'expo-router';
import { RewardPanel } from '@/modules/rewards/components/RewardPanel';
import { Button } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';
export default function RewardsRoute() { const router = useRouter(); return <Screen><PageHeader title="奖励" description="奖励、领取状态与收货信息。" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} /><RewardPanel /></Screen>; }
