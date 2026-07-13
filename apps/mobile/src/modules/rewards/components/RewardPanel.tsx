import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import { useRewardStore } from '../reward.store';

export function RewardPanel() {
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressOpen, setAddressOpen] = useState(false);
  const configured = useRewardStore((state) => state.configured);
  const rewards = useRewardStore((state) => state.rewards);
  const claims = useRewardStore((state) => state.claims);
  const saved = useRewardStore((state) => state.address);
  const loading = useRewardStore((state) => state.loading);
  const error = useRewardStore((state) => state.error);
  const load = useRewardStore((state) => state.load);
  const save = useRewardStore((state) => state.saveAddress);
  const accept = useRewardStore((state) => state.accept);
  const needsPhysicalAddress = claims.some((claim) => claim.reward.rewardType === 'physical' && ['pending', 'accepted'].includes(claim.status));

  useEffect(() => { if (configured) void load(); }, [configured, load]);
  useEffect(() => { if (saved) { setRecipient(saved.recipient); setPhone(saved.phone); setAddress(saved.address); } }, [saved]);
  useEffect(() => { if (needsPhysicalAddress) setAddressOpen(true); }, [needsPhysicalAddress]);

  return <View className="gap-3">
    <Card><Card.Body className="gap-3"><View className="flex-row flex-wrap justify-between gap-2"><Card.Title>奖励中心</Card.Title><Chip color={configured ? 'success' : 'warning'}>{configured ? '已连接' : '登录后启用'}</Chip></View>
      {loading ? <Text type="body-sm" color="muted">正在加载奖励…</Text> : null}
      {!loading && rewards.length === 0 ? <Text type="body-sm" color="muted">当前暂无可领取奖励</Text> : null}
      {rewards.map((reward) => <View key={reward.id}><Text type="body-sm" weight="semibold">{reward.name}</Text><Text type="body-xs" color="muted">{reward.description}</Text></View>)}
    </Card.Body></Card>

    {claims.map((claim) => <Card key={claim.id} variant="secondary"><Card.Body className="gap-2"><Text type="body-sm" weight="semibold">{claim.reward.name}</Text><Text type="body-xs">状态：{claim.status}</Text>{claim.status === 'pending' ? <View className="flex-row gap-2"><Button size="sm" onPress={() => void accept(claim.id, true)}>接受</Button><Button size="sm" variant="secondary" onPress={() => void accept(claim.id, false)}>放弃</Button></View> : null}</Card.Body></Card>)}

    <Button variant="secondary" onPress={() => setAddressOpen((value) => !value)}>{addressOpen ? '收起地址管理' : '管理收货地址'}</Button>
    {addressOpen ? <Card variant="secondary"><Card.Body className="gap-2"><Card.Title>收货地址</Card.Title><Card.Description>{needsPhysicalAddress ? '实物奖励需要有效地址。' : '仅在领取实物奖励时使用。'}</Card.Description><TextField><Label>收件人</Label><Input value={recipient} onChangeText={setRecipient} /></TextField><TextField><Label>手机号</Label><Input value={phone} onChangeText={setPhone} /></TextField><TextField><Label>详细地址</Label><Input value={address} onChangeText={setAddress} multiline /></TextField><Button size="sm" isDisabled={!configured || !recipient.trim() || !phone.trim() || !address.trim()} onPress={() => void save({ recipient, phone, address })}>加密保存地址</Button></Card.Body></Card> : null}
    {error ? <Card variant="secondary"><Card.Body className="gap-2"><Text type="body-sm" color="danger">{error}</Text><Button size="sm" variant="secondary" onPress={() => void load()}>重试</Button></Card.Body></Card> : null}
  </View>;
}
