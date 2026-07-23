import { fireEvent, render } from '@testing-library/react-native';

const mockSocialState: any = {
  configured: true,
  friends: [],
  matches: [],
  rooms: [],
  reactions: [],
  loading: false,
  error: null,
  load: jest.fn(async () => undefined),
  setEnabled: jest.fn(),
  invite: jest.fn(async () => undefined),
  accept: jest.fn(async () => undefined),
  createPk: jest.fn(async () => undefined),
  createRoom: jest.fn(async () => undefined),
  joinRoom: jest.fn(async () => undefined),
  joinByCode: jest.fn(async () => undefined),
  react: jest.fn(async () => undefined),
};

jest.mock('heroui-native/avatar', () => require('../../../../test/social-heroui.mock').avatarModule);
jest.mock('heroui-native/list-group', () => require('../../../../test/social-heroui.mock').listGroupModule);
jest.mock('heroui-native/skeleton', () => require('../../../../test/social-heroui.mock').skeletonModule);
jest.mock('heroui-native/surface', () => require('../../../../test/social-heroui.mock').surfaceModule);
jest.mock('@/ui/bottom-sheet-modal', () => {
  const { View, Text } = require('react-native');
  return {
    BottomSheetModal: ({ visible, title, children }: any) => (visible ? <View accessibilityLabel={`sheet-${title}`}><Text>{title}</Text>{children}</View> : null),
  };
});
jest.mock('../social.store', () => ({ useSocialStore: (selector: (state: any) => unknown) => selector(mockSocialState) }));

import { SocialChallengePanel } from '../components/SocialPanels';

beforeEach(() => {
  mockSocialState.configured = true;
  mockSocialState.friends = [];
  mockSocialState.matches = [];
  mockSocialState.rooms = [];
  mockSocialState.reactions = [];
  mockSocialState.loading = false;
  mockSocialState.error = null;
  jest.clearAllMocks();
});

test('renders challenge-first home without permanent invite forms', async () => {
  mockSocialState.friends = [{ id: 'friend-1', status: 'accepted', direction: 'incoming', user: { id: 'user-1', nickname: 'Alice', avatarUrl: null }, createdAt: '2026-07-18T00:00:00.000Z' }];
  mockSocialState.matches = [{
    id: 'pk-1', status: 'active', date: '2026-07-23',
    challenger: { id: 'me', nickname: 'Me', minutes: 40 },
    opponent: { id: 'user-1', nickname: 'Alice', minutes: 25 },
  }];

  const screen = await render(<SocialChallengePanel />);

  expect(screen.getByLabelText('今日 PK')).toBeTruthy();
  expect(screen.getByText('发起 PK')).toBeTruthy();
  expect(screen.queryByText('friend@example.com')).toBeNull();
  expect(screen.getByText('最近战绩')).toBeTruthy();
});

test('opens friend sheet from challenge badge', async () => {
  mockSocialState.friends = [{ id: 'friend-1', status: 'accepted', direction: 'incoming', user: { id: 'user-1', nickname: 'Alice', avatarUrl: null }, createdAt: '2026-07-18T00:00:00.000Z' }];
  const screen = await render(<SocialChallengePanel />);
  await fireEvent.press(screen.getByText('好友 1'));
  expect(screen.getByLabelText('sheet-好友')).toBeTruthy();
  expect(screen.getByText('AL')).toBeTruthy();
});

test('uses a HeroUI skeleton while social data is loading', async () => {
  mockSocialState.loading = true;

  const screen = await render(<SocialChallengePanel />);

  expect(screen.getByLabelText('挑战数据加载占位').props.accessibilityState).toEqual({ busy: true });
});
