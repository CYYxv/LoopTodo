import { StatisticsPanel } from '@/modules/scoring/components/StatisticsPanel';
import { useTaskStore } from '@/modules/tasks/task.store';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function StatisticsRoute() {
  const records = useTaskStore((state) => state.sessionRecords);
  const tasks = useTaskStore((state) => state.tasks);
  return <Screen><PageHeader title="统计" description="查看专注趋势、记录与失败复盘" /><StatisticsPanel records={records} tasks={tasks} /></Screen>;
}
