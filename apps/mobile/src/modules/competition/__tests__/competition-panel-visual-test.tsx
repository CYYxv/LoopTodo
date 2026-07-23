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

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
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
jest.mock('../competition.store', () => ({ useCompetitionStore: (selector: (state: any) => unknown) => selector(mockCompetitionState) }));

import { CompetitionPanel } from '../components/CompetitionPanel';

beforeEach(() => {
  mockCompetitionState.configured = true;
  mockCompetitionState.period = 'today';
  mockCompetitionState.rank = {
    season: { id: 's1', name: '2026-S2', startsAt: '2026-07-01T00:00:00.000Z', endsAt: '2027-01-01T00:00:00.000Z' },
    score: 25,
    stars: 25,
    tier: 'gold',
    startingTier: 'bronze',
    subTier: 'III',
    starsInSub: 4,
    starCapacity: 5,
    starsToNext: 1,
    displayName: '黄金 III',
    nextDisplayName: '黄金 II',
    starBar: '★★★★☆',
    nextThreshold: 36,
  };
  mockCompetitionState.leaderboard = [];
  mockCompetitionState.membership = null;
  mockCompetitionState.teams = [];
  mockCompetitionState.loading = false;
  mockCompetitionState.error = null;
  jest.clearAllMocks();
});

test('renders star rank hero before leaderboard lists', async () => {
  mockCompetitionState.leaderboard = [{ position: 1, user: { id: 'user-1', nickname: 'Alice', avatarUrl: null }, score: 12, focusMinutes: 90 }];
  mockCompetitionState.teams = [{ id: 'team-1', name: 'Loopers', memberCount: 8, totalScore: 800, score: 800, position: 1 }];

  const screen = await render(<CompetitionPanel />);

  expect(screen.getByLabelText('段位与赛季')).toBeTruthy();
  expect(screen.getByText('黄金 III')).toBeTruthy();
  expect(screen.getByText(/再 1 星升/)).toBeTruthy();
  expect(screen.getByLabelText('个人排位榜')).toBeTruthy();
  expect(screen.getByText('AL')).toBeTruthy();
  expect(screen.getByLabelText('战队排行榜')).toBeTruthy();
});

test('uses a HeroUI skeleton while rankings are loading', async () => {
  mockCompetitionState.loading = true;
  mockCompetitionState.rank = null;

  const screen = await render(<CompetitionPanel />);

  expect(screen.getByLabelText('排位加载占位').props.accessibilityState).toEqual({ busy: true });
});
