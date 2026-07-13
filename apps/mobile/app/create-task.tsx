import { useRouter } from 'expo-router';

import { TaskCreateForm } from '@/modules/tasks/components/TasksPanel';
import { useTaskStore } from '@/modules/tasks/task.store';
import { Button } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function CreateTaskRoute() {
  const router = useRouter();
  const createTask = useTaskStore((state) => state.createTask);
  return <Screen><PageHeader title="创建任务" description="普通任务只需任务名、计时方式和时长。" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>取消</Button>} /><TaskCreateForm onCreate={createTask} onCreated={() => router.back()} /></Screen>;
}
