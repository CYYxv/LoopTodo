import { StatisticsPanel } from '@/modules/scoring/components/StatisticsPanel';
import { useTaskStore } from '@/modules/tasks/task.store';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function DataRoute() {
  const records = useTaskStore((state) => state.sessionRecords);
  return <Screen><PageHeader title="数据" description="查看今日、累计、可信记录与失败复盘。" /><StatisticsPanel records={records} /></Screen>;
}
