import { lockEngine } from '@/modules/lock-engine/lock-engine.store';

import type { ForcedTriggerScheduler } from './forced-trigger.scheduler';

export function createNativeForcedTriggerScheduler(): ForcedTriggerScheduler {
  return { schedule: (rule) => lockEngine.scheduleForcedRule(rule), cancel: (id) => lockEngine.cancelForcedRule(id),
    markSatisfied: (id) => lockEngine.markForcedRuleSatisfied(id) };
}
