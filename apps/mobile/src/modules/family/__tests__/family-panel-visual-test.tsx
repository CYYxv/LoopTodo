import { render } from '@testing-library/react-native';

const mockFamilyState: any = {
  configured: true,
  groups: [],
  assignments: [],
  requests: {},
  inviteCode: null,
  childStatus: null,
  loading: false,
  error: null,
  load: jest.fn(async () => undefined),
  createGroup: jest.fn(async () => undefined),
  invite: jest.fn(async () => undefined),
  join: jest.fn(async () => undefined),
  assign: jest.fn(async () => undefined),
  leave: jest.fn(async () => undefined),
  requestChange: jest.fn(async () => undefined),
  loadRequests: jest.fn(async () => undefined),
  review: jest.fn(async () => undefined),
  loadStatus: jest.fn(async () => undefined),
};

jest.mock('heroui-native/avatar', () => require('../../../../test/social-heroui.mock').avatarModule);
jest.mock('heroui-native/list-group', () => require('../../../../test/social-heroui.mock').listGroupModule);
jest.mock('heroui-native/skeleton', () => require('../../../../test/social-heroui.mock').skeletonModule);
jest.mock('heroui-native/surface', () => require('../../../../test/social-heroui.mock').surfaceModule);
jest.mock('../family.store', () => ({ useFamilyStore: (selector: (state: any) => unknown) => selector(mockFamilyState) }));

import { FamilyPanel } from '../components/FamilyPanel';

beforeEach(() => {
  mockFamilyState.configured = true;
  mockFamilyState.groups = [];
  mockFamilyState.assignments = [];
  mockFamilyState.requests = {};
  mockFamilyState.inviteCode = null;
  mockFamilyState.childStatus = null;
  mockFamilyState.loading = false;
  mockFamilyState.error = null;
  jest.clearAllMocks();
});

test('renders family members with HeroUI lists, avatars, and role chips', async () => {
  mockFamilyState.groups = [{
    id: 'membership-1',
    role: 'parent',
    familyGroup: {
      id: 'family-1',
      name: 'Loop 家庭',
      members: [
        { id: 'member-1', role: 'parent', user: { id: 'parent-1', nickname: 'Alice' } },
        { id: 'member-2', role: 'child', user: { id: 'child-1', nickname: 'Bob' } },
      ],
    },
  }];

  const screen = await render(<FamilyPanel />);

  expect(screen.getByLabelText('家庭概览')).toBeTruthy();
  expect(screen.getByLabelText('家庭成员')).toBeTruthy();
  expect(screen.getByText('AL')).toBeTruthy();
  expect(screen.getByText('BO')).toBeTruthy();
  expect(screen.getByText('家长')).toBeTruthy();
  expect(screen.getByText('孩子')).toBeTruthy();
});

test('uses a HeroUI skeleton while family data is loading', async () => {
  mockFamilyState.loading = true;

  const screen = await render(<FamilyPanel />);

  expect(screen.getByLabelText('家庭数据加载占位').props.accessibilityState).toEqual({ busy: true });
});
