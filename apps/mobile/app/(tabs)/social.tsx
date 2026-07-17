import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { CompetitionPanel } from '@/modules/competition/components/CompetitionPanel';
import { FamilyPanel } from '@/modules/family/components/FamilyPanel';
import { SocialInteractionPanel } from '@/modules/social/components/SocialPanels';
import { Button } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

const sections = ['interaction', 'ranking', 'family'] as const;
type SocialSection = typeof sections[number];
const sectionLabels: Record<SocialSection, string> = { interaction: '互动', ranking: '排行', family: '家庭' };

export default function SocialRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const requested = Array.isArray(params.section) ? params.section[0] : params.section;
  const section: SocialSection = sections.includes(requested as SocialSection) ? requested as SocialSection : 'interaction';

  return (
    <Screen>
      <PageHeader title="社交" description="互动、排行和家庭功能按需加载。" />
      <View className="flex-row gap-2">
        {sections.map((item) => (
          <Button key={item} size="sm" className="flex-1" variant={section === item ? 'primary' : 'secondary'} onPress={() => router.setParams({ section: item })}>
            {sectionLabels[item]}
          </Button>
        ))}
      </View>
      {section === 'interaction' ? <SocialInteractionPanel /> : null}
      {section === 'ranking' ? <CompetitionPanel /> : null}
      {section === 'family' ? <FamilyPanel /> : null}
    </Screen>
  );
}
