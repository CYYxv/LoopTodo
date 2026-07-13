import { Redirect } from 'expo-router';

import { useAuthStore } from '@/modules/auth/auth.store';
import { LoadingScreen } from '@/screens/LoadingScreen';

export default function IndexRoute() {
  const status = useAuthStore((state) => state.status);
  if (status === 'hydrating') return <LoadingScreen label="正在恢复账号与本地任务…" />;
  return <Redirect href={status === 'signed_in' ? '/today' : '/login'} />;
}
