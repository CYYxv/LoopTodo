import { StatisticsPanel } from '@/modules/scoring/components/StatisticsPanel';
import { useTaskStore } from '@/modules/tasks/task.store';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function StatisticsRoute() {
  const records = useTaskStore((state) => state.sessionRecords);
  const tasks = useTaskStore((state) => state.tasks);
  return <Screen><PageHeader title="统计" description="用专注数据看见节奏、趋势与进步" /><StatisticsPanel records={records} tasks={tasks} /></Screen>;
}
