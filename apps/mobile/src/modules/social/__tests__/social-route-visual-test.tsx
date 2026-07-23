import { fireEvent, render } from '@testing-library/react-native';

const mockSetParams = jest.fn();
let mockSection: string | string[] | undefined;

jest.mock('expo-router', () => ({
  useRouter: () => ({ setParams: mockSetParams }),
  useLocalSearchParams: () => ({ section: mockSection }),
}));
jest.mock('heroui-native/tabs', () => require('../../../../test/social-heroui.mock').tabsModule);
jest.mock('@/ui/screen-layout', () => {
  const { Text, View } = require('react-native');
  return {
    Screen: ({ children }: any) => <View>{children}</View>,
    PageHeader: ({ title, description }: any) => <View><Text>{title}</Text>{description ? <Text>{description}</Text> : null}</View>,
  };
});
jest.mock('@/modules/social/components/SocialPanels', () => {
  const { Text } = require('react-native');
  return { SocialChallengePanel: () => <Text>challenge-panel</Text>, SocialInteractionPanel: () => <Text>challenge-panel</Text> };
});
jest.mock('@/modules/competition/components/CompetitionPanel', () => {
  const { Text } = require('react-native');
  return { CompetitionPanel: () => <Text>ranking-panel</Text> };
});
jest.mock('@/modules/family/components/FamilyPanel', () => {
  const { Text } = require('react-native');
  return { FamilyPanel: () => <Text>family-panel</Text> };
});

import SocialRoute from '../../../../app/(tabs)/social';

beforeEach(() => {
  mockSection = undefined;
  mockSetParams.mockClear();
});

test('uses HeroUI tabs and updates the URL section', async () => {
  const screen = await render(<SocialRoute />);

  expect(screen.getByLabelText('社交分区')).toBeTruthy();
  expect(screen.getByRole('tab', { name: '挑战', selected: true })).toBeTruthy();

  fireEvent.press(screen.getByRole('tab', { name: '排位' }));

  expect(mockSetParams).toHaveBeenCalledWith({ section: 'ranking' });
});

test.each([
  [undefined, 'challenge-panel', ['ranking-panel', 'family-panel']],
  ['interaction', 'challenge-panel', ['ranking-panel', 'family-panel']],
  ['challenge', 'challenge-panel', ['ranking-panel', 'family-panel']],
  ['ranking', 'ranking-panel', ['challenge-panel', 'family-panel']],
  ['family', 'family-panel', ['challenge-panel', 'ranking-panel']],
  ['unknown', 'challenge-panel', ['ranking-panel', 'family-panel']],
] as const)('mounts only the active social section for %s', async (section, visible, hidden) => {
  mockSection = section;

  const screen = await render(<SocialRoute />);

  expect(screen.getByText(visible)).toBeTruthy();
  hidden.forEach((label) => expect(screen.queryByText(label)).toBeNull());
});
