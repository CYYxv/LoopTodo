import { configureCompetition } from '@/modules/competition/competition.store';
import { configureFamily } from '@/modules/family/family.store';
import { configureRewards } from '@/modules/rewards/reward.store';
import { configureScoring } from '@/modules/scoring/scoring.store';
import { configureSettings } from '@/modules/settings/settings.store';
import { configureSocial } from '@/modules/social/social.store';
import { configureSubscription } from '@/modules/subscription/subscription.store';
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
}

