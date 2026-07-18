import { render } from '@testing-library/react-native';

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
jest.mock('../social.store', () => ({ useSocialStore: (selector: (state: any) => unknown) => selector(mockSocialState) }));

import { SocialInteractionPanel } from '../components/SocialPanels';

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

test('renders friend and room collections with HeroUI identity primitives', async () => {
  mockSocialState.friends = [{ id: 'friend-1', status: 'accepted', direction: 'incoming', user: { id: 'user-1', nickname: 'Alice', avatarUrl: null }, createdAt: '2026-07-18T00:00:00.000Z' }];
  mockSocialState.rooms = [{ id: 'room-1', name: '晚间自习室', visibility: 'public', inviteCode: null, memberCount: 3, joined: false }];

  const screen = await render(<SocialInteractionPanel />);

  expect(screen.getByLabelText('互动概览')).toBeTruthy();
  expect(screen.getByLabelText('好友与邀请')).toBeTruthy();
  expect(screen.getByText('AL')).toBeTruthy();
  expect(screen.getByLabelText('自习室列表')).toBeTruthy();
});

test('uses a HeroUI skeleton while social data is loading', async () => {
  mockSocialState.loading = true;

  const screen = await render(<SocialInteractionPanel />);

  expect(screen.getByLabelText('社交数据加载占位').props.accessibilityState).toEqual({ busy: true });
});
