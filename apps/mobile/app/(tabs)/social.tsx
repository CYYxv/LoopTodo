import { useLocalSearchParams, useRouter } from 'expo-router';
import { Tabs } from 'heroui-native/tabs';

import { CompetitionPanel } from '@/modules/competition/components/CompetitionPanel';
import { FamilyPanel } from '@/modules/family/components/FamilyPanel';
import { SocialChallengePanel } from '@/modules/social/components/SocialPanels';
import { PageHeader, Screen } from '@/ui/screen-layout';

const sections = ['challenge', 'ranking', 'family'] as const;
type SocialSection = (typeof sections)[number];
const sectionLabels: Record<SocialSection, string> = { challenge: '挑战', ranking: '排位', family: '家庭' };

function normalizeSection(value?: string): SocialSection {
  if (value === 'interaction') return 'challenge';
  if (value === 'ranking' || value === 'family' || value === 'challenge') return value;
  return 'challenge';
}

export default function SocialRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const requested = Array.isArray(params.section) ? params.section[0] : params.section;
  const section = normalizeSection(requested);

  return (
    <Screen>
      <PageHeader title="社交" />
      <Tabs value={section} onValueChange={(value) => router.setParams({ section: value })} accessibilityLabel="社交分区">
        <Tabs.List className="w-full">
          <Tabs.Indicator />
          {sections.map((item) => (
            <Tabs.Trigger key={item} value={item} className="flex-1">
              <Tabs.Label>{sectionLabels[item]}</Tabs.Label>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>
      {section === 'challenge' ? <SocialChallengePanel /> : null}
      {section === 'ranking' ? <CompetitionPanel /> : null}
      {section === 'family' ? <FamilyPanel /> : null}
    </Screen>
  );
}
