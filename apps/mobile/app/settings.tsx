import { useRouter } from 'expo-router';

import { SettingsPanel } from '@/modules/settings/components/SettingsPanel';
import { Button } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function SettingsRoute() { const router = useRouter(); return <Screen><PageHeader title="设置" description="隐私、显示与系统权限" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} /><SettingsPanel /></Screen>; }
