import { useLocalSearchParams, useRouter } from 'expo-router';
import { Tabs } from 'heroui-native/tabs';

import { CompetitionPanel } from '@/modules/competition/components/CompetitionPanel';
import { FamilyPanel } from '@/modules/family/components/FamilyPanel';
import { SocialInteractionPanel } from '@/modules/social/components/SocialPanels';
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
      <Tabs value={section} onValueChange={(value) => router.setParams({ section: value })} accessibilityLabel="社交分区">
        <Tabs.List className="w-full">
          <Tabs.Indicator />
          {sections.map((item) => <Tabs.Trigger key={item} value={item} className="flex-1"><Tabs.Label>{sectionLabels[item]}</Tabs.Label></Tabs.Trigger>)}
        </Tabs.List>
      </Tabs>
      {section === 'interaction' ? <SocialInteractionPanel /> : null}
      {section === 'ranking' ? <CompetitionPanel /> : null}
      {section === 'family' ? <FamilyPanel /> : null}
    </Screen>
  );
}
