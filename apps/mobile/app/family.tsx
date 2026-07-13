import { useRouter } from 'expo-router';
import { FamilyPanel } from '@/modules/family/components/FamilyPanel';
import { Button } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';
export default function FamilyRoute() { const router = useRouter(); return <Screen><PageHeader title="家庭" description="家庭组、家长任务和修改申请。" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} /><FamilyPanel /></Screen>; }
