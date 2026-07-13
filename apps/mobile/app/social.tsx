import { useRouter } from 'expo-router';
import { SocialPanel } from '@/modules/social/components/SocialPanels';
import { Button } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';
export default function SocialRoute() { const router = useRouter(); return <Screen><PageHeader title="社交与战队" description="好友 PK、自习室和竞赛。" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} /><SocialPanel /></Screen>; }
