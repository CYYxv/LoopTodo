import { View } from 'react-native';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Text } from 'heroui-native/text';

export type PanelKey = 'tasks' | 'focus' | 'habits' | 'statistics' | 'social' | 'family';

const panelLabels: Record<PanelKey, string> = {
  tasks: '待办',
  focus: '专注',
  habits: '习惯',
  statistics: '数据',
  social: '战队',
  family: '家庭',
};

export function Header() {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View>
          <Text type="h2" weight="bold">
            LoopTodo
          </Text>
          <Text type="body-sm" color="muted">
            把任务推进到完成
          </Text>
        </View>
        <Chip variant="secondary" color="accent">
          <Chip.Label>黄金 III</Chip.Label>
        </Chip>
      </View>
      <Text type="body-sm" color="muted">
        今天的原则：该做事时进入闭环，该玩时安心玩。
      </Text>
    </View>
  );
}

export function DashboardSummary({
  todayMinutes,
  completedSessions,
}: {
  todayMinutes: number;
  completedSessions: number;
}) {
  return (
    <View className="flex-row gap-3">
      <MetricCard label="今日计划" value={`${todayMinutes}m`} />
      <MetricCard label="完成闭环" value={`${completedSessions} 次`} />
      <MetricCard label="紧急退出" value="2/2" />
    </View>
  );
}

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-1">
      <Card.Body className="gap-1">
        <Text type="body-xs" color="muted">
          {label}
        </Text>
        <Text type="h4" weight="bold">
          {value}
        </Text>
      </Card.Body>
    </Card>
  );
}

export function PanelTabs({
  activePanel,
  onPanelChange,
}: {
  activePanel: PanelKey;
  onPanelChange: (panel: PanelKey) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {(Object.keys(panelLabels) as PanelKey[]).map((panel) => (
        <Button
          key={panel}
          size="sm"
          variant={activePanel === panel ? 'primary' : 'secondary'}
          accessibilityLabel={`切换到${panelLabels[panel]}`}
          onPress={() => onPanelChange(panel)}
          className="min-w-16 flex-1"
        >
          {panelLabels[panel]}
        </Button>
      ))}
    </View>
  );
}
