import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Input, Label, Text, TextField } from '@/ui/hero-runtime';

import { useAuthStore } from '../auth.store';

export function AccountCard() {
  const status = useAuthStore((state) => state.status);
  const baseUrl = useAuthStore((state) => state.baseUrl);
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);
  const setBaseUrl = useAuthStore((state) => state.setBaseUrl);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const [server, setServer] = useState(baseUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [registering, setRegistering] = useState(false);

  if (user) {
    return <Card variant="secondary"><Card.Body className="gap-3"><View><Card.Title>{user.nickname}</Card.Title><Card.Description>{user.email} · {user.vipStatus === 'active' ? 'VIP' : '免费版'}</Card.Description></View><Button size="sm" variant="secondary" onPress={() => void logout()}>退出登录</Button>{error ? <Text type="body-xs" accessibilityRole="alert">{error}</Text> : null}</Card.Body></Card>;
  }

  const submit = async () => {
    try {
      await setBaseUrl(server);
      if (registering) await register(email, password, nickname);
      else await login(email, password);
    } catch {
      return;
    }
  };

  return (
    <Card variant="secondary">
      <Card.Body className="gap-3">
        <View><Card.Title>连接 LoopTodo 云端</Card.Title><Card.Description>离线任务无需登录；同步、社交、家庭、VIP 和奖励需要账号。</Card.Description></View>
        <Field label="API 地址" value={server} onChange={setServer} placeholder="https://api.example.com" />
        <Field label="邮箱" value={email} onChange={setEmail} placeholder="name@example.com" />
        <TextField><Label>密码</Label><Input value={password} onChangeText={setPassword} secureTextEntry placeholder="至少 8 位" /></TextField>
        {registering ? <Field label="昵称" value={nickname} onChange={setNickname} placeholder="LoopTodo 用户" /> : null}
        <View className="flex-row flex-wrap gap-2"><Button className="min-w-28 flex-1" isDisabled={status === 'hydrating' || !server.trim() || !email.trim() || password.length < 8} onPress={() => void submit()}>{status === 'hydrating' ? '连接中…' : registering ? '注册并登录' : '登录'}</Button><Button variant="secondary" onPress={() => setRegistering((value) => !value)}>{registering ? '已有账号' : '创建账号'}</Button></View>
        {error ? <Text type="body-xs" accessibilityRole="alert">{error}</Text> : null}
      </Card.Body>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange(value: string): void; placeholder: string }) {
  return <TextField><Label>{label}</Label><Input value={value} onChangeText={onChange} placeholder={placeholder} autoCapitalize="none" /></TextField>;
}
