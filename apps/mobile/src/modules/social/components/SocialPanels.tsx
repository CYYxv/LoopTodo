import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Avatar } from 'heroui-native/avatar';
import { ListGroup } from 'heroui-native/list-group';
import { Skeleton } from 'heroui-native/skeleton';
import { Surface } from 'heroui-native/surface';

import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Input, Label, Text, TextField } from '@/ui/hero-runtime';

import { useSocialStore } from '../social.store';
import type { Friend, PkMatch, StudyRoom } from '../social.types';

/** Challenge tab: PK-first. Friends/invites and room list live in sheets/secondary pages. */
export function SocialChallengePanel() {
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [pkPickOpen, setPkPickOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<Friend | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [email, setEmail] = useState('');
  const [roomName, setRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const configured = useSocialStore((state) => state.configured);
  const friends = useSocialStore((state) => state.friends);
  const matches = useSocialStore((state) => state.matches);
  const rooms = useSocialStore((state) => state.rooms);
  const reactions = useSocialStore((state) => state.reactions);
  const loading = useSocialStore((state) => state.loading);
  const error = useSocialStore((state) => state.error);
  const load = useSocialStore((state) => state.load);
  const setEnabled = useSocialStore((state) => state.setEnabled);
  const invite = useSocialStore((state) => state.invite);
  const accept = useSocialStore((state) => state.accept);
  const remove = useSocialStore((state) => state.remove);
  const block = useSocialStore((state) => state.block);
  const report = useSocialStore((state) => state.report);
  const createPk = useSocialStore((state) => state.createPk);
  const createRoom = useSocialStore((state) => state.createRoom);
  const joinRoom = useSocialStore((state) => state.joinRoom);
  const joinByCode = useSocialStore((state) => state.joinByCode);
  const react = useSocialStore((state) => state.react);

  useEffect(() => {
    if (!configured) return;
    setEnabled(true);
    void load();
    return () => setEnabled(false);
  }, [configured, load, setEnabled]);

  const accepted = useMemo(() => friends.filter((item) => item.status === 'accepted'), [friends]);
  const pendingIncoming = useMemo(
    () => friends.filter((item) => item.status === 'pending' && item.direction === 'incoming'),
    [friends],
  );
  const activeMatch = matches[0] ?? null;
  const currentRoom = rooms.find((room) => room.joined) ?? null;
  const record = useMemo(() => summarizeMatches(matches), [matches]);

  if (loading && friends.length === 0 && matches.length === 0) {
    return <Skeleton accessibilityLabel="挑战数据加载占位" accessibilityState={{ busy: true }} className="h-48 rounded-2xl" />;
  }

  return (
    <View className="gap-4">
      <Surface accessibilityLabel="今日 PK" className="gap-4 rounded-2xl p-4">
        <View className="flex-row items-center justify-between">
          <Text type="body-lg" weight="semibold">今日 PK</Text>
          <Button size="sm" variant="secondary" onPress={() => setFriendsOpen(true)}>
            {pendingIncoming.length > 0 ? `邀请 ${pendingIncoming.length}` : `好友 ${accepted.length}`}
          </Button>
        </View>

        {activeMatch ? <PkCard match={activeMatch} /> : (
          <View className="gap-2 rounded-xl bg-default-100 p-4">
            <Text type="body-sm" weight="semibold">今天还没有进行中的 PK</Text>
            <Text type="body-xs" color="muted">选择一位好友，比拼当日有效专注分钟。</Text>
          </View>
        )}

        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" className="flex-1" isDisabled={!configured} onPress={() => setPkPickOpen(true)}>发起 PK</Button>
          <Button size="sm" variant="secondary" className="flex-1" isDisabled={!configured || accepted.length === 0} onPress={() => setPkPickOpen(true)}>一起专注</Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            isDisabled={!configured}
            onPress={() => setRoomsOpen(true)}
          >
            {currentRoom ? '当前自习室' : '进入自习室'}
          </Button>
        </View>

        {currentRoom ? (
          <Surface variant="secondary" className="gap-2 rounded-xl p-3">
            <Text type="body-sm" weight="semibold">{currentRoom.name}</Text>
            <Text type="body-xs" color="muted">
              {currentRoom.memberCount} 人 · {currentRoom.visibility === 'private' ? '私密' : '公开'} · 无聊天
            </Text>
            <View className="flex-row gap-3">
              {['💪', '🔥', '👏', '🌱', '🏆'].map((emoji) => (
                <Text key={emoji} type="h4" onPress={() => void react(currentRoom.id, emoji)}>{emoji}</Text>
              ))}
            </View>
            {reactions.slice(-3).map((item, index) => (
              <Text key={`${item.createdAt}-${index}`} type="body-xs" color="muted">{item.nickname} {item.emoji}</Text>
            ))}
          </Surface>
        ) : null}
      </Surface>

      <Surface className="gap-2 rounded-2xl p-4">
        <Text type="body-lg" weight="semibold">最近战绩</Text>
        <Text type="body-sm" color="muted">胜 {record.wins}  ·  负 {record.losses}  ·  连胜 {record.streak}</Text>
        {matches.slice(0, 3).map((match) => (
          <Text key={match.id} type="body-xs" color="muted">
            {match.challenger.nickname} {match.challenger.minutes}m : {match.opponent.minutes}m {match.opponent.nickname}
          </Text>
        ))}
      </Surface>

      {error ? (
        <View className="gap-2">
          <Text type="body-xs" color="danger">{error}</Text>
          <Button size="sm" variant="secondary" onPress={() => void load()}>重试</Button>
        </View>
      ) : null}

      <BottomSheetModal visible={friendsOpen} title="好友" onClose={() => setFriendsOpen(false)}>
        <Button size="sm" onPress={() => { setFriendsOpen(false); setInviteOpen(true); }}>邀请好友</Button>
        {pendingIncoming.length > 0 ? (
          <ListGroup accessibilityLabel="待处理邀请" variant="secondary">
            {pendingIncoming.map((friend) => (
              <FriendRow key={friend.id} friend={friend} onAccept={() => void accept(friend.id)} />
            ))}
          </ListGroup>
        ) : null}
        <ListGroup accessibilityLabel="好友列表" variant="secondary">
          {accepted.length === 0 ? (
            <ListGroup.Item disabled>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>还没有专注伙伴</ListGroup.ItemTitle>
                <ListGroup.ItemDescription>邀请一位朋友，一起完成今天的专注。</ListGroup.ItemDescription>
              </ListGroup.ItemContent>
            </ListGroup.Item>
          ) : accepted.map((friend) => (
            <FriendRow
              key={friend.id}
              friend={friend}
              onPk={() => void createPk(friend.user.id)}
              onBlock={() => void block(friend.id)}
              onRemove={() => void remove(friend.id)}
              onReport={() => {
                setReportReason('');
                setReportTarget(friend);
              }}
            />
          ))}
        </ListGroup>
      </BottomSheetModal>

      <BottomSheetModal visible={inviteOpen} title="邀请好友" onClose={() => setInviteOpen(false)}>
        <TextField>
          <Label>好友邮箱</Label>
          <Input value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="friend@example.com" />
        </TextField>
        <Button
          size="sm"
          isDisabled={!configured || !email.trim()}
          onPress={() => {
            void invite(email).then(() => {
              setEmail('');
              setInviteOpen(false);
            });
          }}
        >
          发送邀请
        </Button>
      </BottomSheetModal>

      <BottomSheetModal
        visible={reportTarget != null}
        title="举报用户"
        onClose={() => {
          setReportTarget(null);
          setReportReason('');
        }}
      >
        <Text type="body-sm" color="muted">
          举报 {reportTarget?.user.nickname ?? '用户'}，我们会记录并跟进处理。
        </Text>
        <TextField>
          <Label>举报原因</Label>
          <Input
            value={reportReason}
            onChangeText={setReportReason}
            placeholder="请简要说明原因"
            maxLength={500}
          />
        </TextField>
        <Button
          size="sm"
          isDisabled={!configured || !reportReason.trim() || !reportTarget}
          onPress={() => {
            if (!reportTarget) return;
            void report(reportTarget.user.id, reportReason.trim()).then((ok) => {
              if (!ok) return;
              setReportOpen(false);
              setReportTarget(null);
              setReportReason('');
            });
          }}
        >
          提交举报
        </Button>
      </BottomSheetModal>

      <BottomSheetModal visible={pkPickOpen} title="选择 PK 对手" onClose={() => setPkPickOpen(false)}>
        {accepted.length === 0 ? (
          <View className="gap-3">
            <Text type="body-sm" color="muted">还没有好友，先邀请一位吧。</Text>
            <Button size="sm" onPress={() => { setPkPickOpen(false); setInviteOpen(true); }}>邀请好友</Button>
          </View>
        ) : (
          <ListGroup accessibilityLabel="PK 对手" variant="secondary">
            {accepted.map((friend) => (
              <ListGroup.Item key={friend.id} disabled>
                <ListGroup.ItemPrefix>
                  <Avatar color="accent" variant="soft" size="sm">
                    <Avatar.Fallback>{initials(friend.user.nickname)}</Avatar.Fallback>
                  </Avatar>
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{friend.user.nickname}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Button
                    size="sm"
                    onPress={() => {
                      void createPk(friend.user.id);
                      setPkPickOpen(false);
                    }}
                  >
                    发起
                  </Button>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </BottomSheetModal>

      <BottomSheetModal visible={roomsOpen} title="自习室" onClose={() => setRoomsOpen(false)}>
        <TextField>
          <Label>房间名称（1–15 字）</Label>
          <Input value={roomName} onChangeText={setRoomName} maxLength={15} placeholder="深夜自习" />
        </TextField>
        <View className="flex-row flex-wrap gap-2">
          <Button
            size="sm"
            isDisabled={!configured || roomName.trim().length < 1 || roomName.trim().length > 15}
            onPress={() => void createRoom(roomName.trim(), 'public')}
          >
            创建公开房
          </Button>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={!configured || roomName.trim().length < 1 || roomName.trim().length > 15}
            onPress={() => void createRoom(roomName.trim(), 'private')}
          >
            创建私密房
          </Button>
        </View>
        <TextField>
          <Label>私密房邀请码</Label>
          <Input value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" />
        </TextField>
        <Button size="sm" variant="secondary" isDisabled={!configured || !inviteCode.trim()} onPress={() => void joinByCode(inviteCode)}>
          使用邀请码加入
        </Button>
        <ListGroup accessibilityLabel="自习室列表" variant="secondary">
          {rooms.length === 0 ? (
            <ListGroup.Item disabled>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>暂无可加入的自习室</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
            </ListGroup.Item>
          ) : rooms.map((room) => (
            <RoomRow key={room.id} room={room} onJoin={() => void joinRoom(room)} />
          ))}
        </ListGroup>
      </BottomSheetModal>
    </View>
  );
}

/** @deprecated use SocialChallengePanel */
export const SocialInteractionPanel = SocialChallengePanel;

function PkCard({ match }: { match: PkMatch }) {
  const left = match.challenger;
  const right = match.opponent;
  const total = Math.max(1, left.minutes + right.minutes);
  const leftRatio = left.minutes / total;
  return (
    <View className="gap-3 rounded-xl bg-default-100 p-4">
      <View className="flex-row items-center justify-between">
        <View className="items-center gap-1">
          <Avatar color="accent" variant="soft" size="md"><Avatar.Fallback>{initials(left.nickname)}</Avatar.Fallback></Avatar>
          <Text type="body-xs">{left.nickname}</Text>
          <Text type="body-sm" weight="semibold">{left.minutes} 分</Text>
        </View>
        <View className="items-center">
          <Text type="h4" weight="semibold" color="accent">{left.minutes - right.minutes >= 0 ? `+${left.minutes - right.minutes}` : `${left.minutes - right.minutes}`}</Text>
          <Text type="body-xs" color="muted">分钟差</Text>
        </View>
        <View className="items-center gap-1">
          <Avatar color="default" variant="soft" size="md"><Avatar.Fallback>{initials(right.nickname)}</Avatar.Fallback></Avatar>
          <Text type="body-xs">{right.nickname}</Text>
          <Text type="body-sm" weight="semibold">{right.minutes} 分</Text>
        </View>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-default-200">
        <View className="h-full rounded-full bg-accent" style={{ width: `${Math.round(leftRatio * 100)}%` }} />
      </View>
      <Text type="body-xs" color="muted">按当日有效专注分钟结算 · 胜负不额外加星</Text>
    </View>
  );
}

function FriendRow({
  friend,
  onAccept,
  onPk,
  onBlock,
  onRemove,
  onReport,
}: {
  friend: Friend;
  onAccept?: () => void;
  onPk?: () => void;
  onBlock?: () => void;
  onRemove?: () => void;
  onReport?: () => void;
}) {
  const accepted = friend.status === 'accepted';
  return (
    <ListGroup.Item disabled>
      <ListGroup.ItemPrefix>
        <Avatar color="accent" variant="soft" size="sm">
          <Avatar.Fallback>{initials(friend.user.nickname)}</Avatar.Fallback>
        </Avatar>
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{friend.user.nickname}</ListGroup.ItemTitle>
        <ListGroup.ItemDescription>
          {accepted ? '好友' : friend.direction === 'incoming' ? '等待你接受' : '已发送邀请'}
        </ListGroup.ItemDescription>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <View className="max-w-[200px] flex-row flex-wrap items-center justify-end gap-1">
          {onAccept ? <Button size="sm" onPress={onAccept}>接受</Button> : null}
          {accepted && onPk ? <Button size="sm" variant="secondary" onPress={onPk}>PK</Button> : null}
          {accepted && onBlock ? <Button size="sm" variant="secondary" onPress={onBlock}>拉黑</Button> : null}
          {accepted && onRemove ? <Button size="sm" variant="secondary" onPress={onRemove}>删除</Button> : null}
          {accepted && onReport ? <Button size="sm" variant="secondary" onPress={onReport}>举报</Button> : null}
        </View>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

function RoomRow({ room, onJoin }: { room: StudyRoom; onJoin: () => void }) {
  return (
    <ListGroup.Item disabled>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{room.name}</ListGroup.ItemTitle>
        <ListGroup.ItemDescription>
          {room.visibility === 'private' ? `私密 · ${room.memberCount} 人` : `公开 · ${room.memberCount} 人`}
        </ListGroup.ItemDescription>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <Button size="sm" onPress={onJoin}>{room.joined ? '进入' : '加入'}</Button>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

function summarizeMatches(matches: PkMatch[]) {
  let wins = 0;
  let losses = 0;
  let streak = 0;
  for (const match of matches) {
    const mine = match.challenger.minutes;
    const theirs = match.opponent.minutes;
    if (mine === theirs) continue;
    if (mine > theirs) {
      wins += 1;
      streak += 1;
    } else {
      losses += 1;
      streak = 0;
    }
  }
  return { wins, losses, streak };
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'LT';
}