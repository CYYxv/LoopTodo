import { competitionStore, configureCompetition } from '@/modules/competition/competition.store';
import { configureFamily, familyStore } from '@/modules/family/family.store';
import { configureRewards, rewardStore } from '@/modules/rewards/reward.store';
import { configureScoring, scoringStore } from '@/modules/scoring/scoring.store';
import { configureSettings, settingsStore } from '@/modules/settings/settings.store';
import { configureSocial, socialStore } from '@/modules/social/social.store';
import { configureSubscription, subscriptionStore } from '@/modules/subscription/subscription.store';
import { configureSync } from '@/modules/sync/sync.store';
import { configureTaskAi } from '@/modules/task-ai/task-ai.store';

export function configureCloudSession(baseUrl: string, accessToken: string) {
  configureSync(baseUrl, accessToken);
  configureTaskAi(baseUrl, accessToken);
  configureScoring(baseUrl, accessToken);
  configureSocial(baseUrl, accessToken);
  configureCompetition(baseUrl, accessToken);
  configureSubscription(baseUrl, accessToken);
  configureFamily(baseUrl, accessToken);
  configureRewards(baseUrl, accessToken);
  configureSettings(baseUrl, accessToken);
  void subscriptionStore.getState().load();
  void settingsStore.getState().load();
}

export function clearCloudSession() {
  socialStore.getState().setEnabled(false);
  socialStore.setState({ configured: false, baseUrl: '', token: '', client: null, friends: [], matches: [], rooms: [], reactions: [], error: null });
  competitionStore.setState({ configured: false, client: null, rank: null, leaderboard: [], membership: null, teams: [], loading: false, error: null });
  familyStore.setState({ configured: false, client: null, groups: [], assignments: [], requests: {}, inviteCode: null, childStatus: null, loading: false, error: null });
  rewardStore.setState({ configured: false, baseUrl: '', token: '', rewards: [], claims: [], address: null, loading: false, error: null });
  scoringStore.setState({ configured: false, client: null, today: null, history: [], loading: false, error: null });
  subscriptionStore.setState({ configured: false, client: null, entitlements: null, order: null, loading: false, error: null });
  settingsStore.setState({ configured: false, baseUrl: '', token: '', value: null, loading: false, error: null });
}
