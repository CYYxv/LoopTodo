import { render } from '@testing-library/react-native';

const mockCompetitionState: any = {
  configured: true,
  period: 'today',
  rank: null,
  leaderboard: [],
  membership: null,
  teams: [],
  loading: false,
  error: null,
  load: jest.fn(async () => undefined),
  setPeriod: jest.fn(async () => undefined),
  createTeam: jest.fn(async () => undefined),
  joinTeam: jest.fn(async () => undefined),
};

jest.mock('heroui-native/avatar', () => require('../../../../test/social-heroui.mock').avatarModule);
jest.mock('heroui-native/list-group', () => require('../../../../test/social-heroui.mock').listGroupModule);
jest.mock('heroui-native/skeleton', () => require('../../../../test/social-heroui.mock').skeletonModule);
jest.mock('heroui-native/surface', () => require('../../../../test/social-heroui.mock').surfaceModule);
jest.mock('../competition.store', () => ({ useCompetitionStore: (selector: (state: any) => unknown) => selector(mockCompetitionState) }));

import { CompetitionPanel } from '../components/CompetitionPanel';

beforeEach(() => {
  mockCompetitionState.configured = true;
  mockCompetitionState.period = 'today';
  mockCompetitionState.rank = null;
  mockCompetitionState.leaderboard = [];
  mockCompetitionState.membership = null;
  mockCompetitionState.teams = [];
  mockCompetitionState.loading = false;
  mockCompetitionState.error = null;
  jest.clearAllMocks();
});

test('renders personal and team rankings as HeroUI lists with avatars', async () => {
  mockCompetitionState.leaderboard = [{ position: 1, user: { id: 'user-1', nickname: 'Alice', avatarUrl: null }, score: 120, focusMinutes: 90 }];
  mockCompetitionState.teams = [{ id: 'team-1', name: 'Loopers', memberCount: 8, totalScore: 800, score: 800, position: 1 }];

  const screen = await render(<CompetitionPanel />);

  expect(screen.getByLabelText('竞技概览')).toBeTruthy();
  expect(screen.getByLabelText('个人排行榜')).toBeTruthy();
  expect(screen.getByText('AL')).toBeTruthy();
  expect(screen.getByLabelText('战队排行榜')).toBeTruthy();
});

test('uses a HeroUI skeleton while rankings are loading', async () => {
  mockCompetitionState.loading = true;

  const screen = await render(<CompetitionPanel />);

  expect(screen.getByLabelText('排行榜加载占位').props.accessibilityState).toEqual({ busy: true });
});
