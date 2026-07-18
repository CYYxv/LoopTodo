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
    PageHeader: ({ title, description }: any) => <View><Text>{title}</Text><Text>{description}</Text></View>,
  };
});
jest.mock('@/modules/social/components/SocialPanels', () => {
  const { Text } = require('react-native');
  return { SocialInteractionPanel: () => <Text>interaction-panel</Text> };
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
  expect(screen.getByRole('tab', { name: '互动', selected: true })).toBeTruthy();

  fireEvent.press(screen.getByRole('tab', { name: '排行' }));

  expect(mockSetParams).toHaveBeenCalledWith({ section: 'ranking' });
});

test.each([
  [undefined, 'interaction-panel', ['ranking-panel', 'family-panel']],
  ['ranking', 'ranking-panel', ['interaction-panel', 'family-panel']],
  ['family', 'family-panel', ['interaction-panel', 'ranking-panel']],
  ['unknown', 'interaction-panel', ['ranking-panel', 'family-panel']],
] as const)('mounts only the active social section for %s', async (section, visible, hidden) => {
  mockSection = section;

  const screen = await render(<SocialRoute />);

  expect(screen.getByText(visible)).toBeTruthy();
  hidden.forEach((label) => expect(screen.queryByText(label)).toBeNull());
});
