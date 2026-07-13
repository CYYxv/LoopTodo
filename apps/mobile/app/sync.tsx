import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { SyncStatusCard } from '@/modules/sync/components/SyncStatusCard';
import { useSyncStore } from '@/modules/sync/sync.store';
import { Button } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function SyncRoute() {
  const router = useRouter();
  const configured = useSyncStore((state) => state.configured); const pending = useSyncStore((state) => state.pending); const conflicts = useSyncStore((state) => state.conflicts); const isSyncing = useSyncStore((state) => state.isSyncing); const error = useSyncStore((state) => state.error); const hydrate = useSyncStore((state) => state.hydrate); const syncNow = useSyncStore((state) => state.syncNow); const resolve = useSyncStore((state) => state.resolveConflict);
  useEffect(() => { void hydrate(); }, [hydrate]);
  return <Screen><PageHeader title="账号与同步" description="本地任务可离线恢复，联网后同步。" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} /><SyncStatusCard configured={configured} pending={pending} conflicts={conflicts} isSyncing={isSyncing} error={error} onSync={() => void syncNow()} onResolve={(id, strategy) => void resolve(id, strategy)} /></Screen>;
}
