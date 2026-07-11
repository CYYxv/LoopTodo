import { View } from 'react-native';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';

import { MetricCard } from '@/screens/components/DashboardChrome';

export function SocialPanel() {
  return (
    <View className="gap-4">
      <Card>
        <Card.Body className="gap-3">
          <Chip size="sm" color="accent" variant="soft">
            S1 赛季 · 还剩 164 天
          </Chip>
          <Card.Title>好友 PK 与战队冲榜</Card.Title>
          <Card.Description>
            当前原型先固定展示赛季、段位、队伍分。后续接入房间、邀请码和排行榜。
          </Card.Description>
          <View className="flex-row gap-3">
            <MetricCard label="个人积分" value="1,284" />
            <MetricCard label="战队人均" value="92m" />
          </View>
          <Button variant="secondary" isDisabled>
            自习室开发中
          </Button>
        </Card.Body>
      </Card>
    </View>
  );
}

export function FamilyPanel() {
  return (
    <Card>
      <Card.Body className="gap-3">
        <Chip size="sm" color="warning" variant="soft">
          家庭组
        </Chip>
        <Card.Title>家长任务与申请修改</Card.Title>
        <Card.Description>
          家长可下发任务和规则，孩子不能直接改删，只能申请修改；家长不能实时远程一键锁机。
        </Card.Description>
        <Button variant="secondary" isDisabled>
          家庭功能开发中
        </Button>
      </Card.Body>
    </Card>
  );
}
