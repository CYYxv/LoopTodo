import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { authStore, useAuthStore } from '@/modules/auth/auth.store';
import { Button, Card, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function LoginRoute() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const baseUrl = useAuthStore((state) => state.baseUrl);
  const error = useAuthStore((state) => state.error);
  const setBaseUrl = useAuthStore((state) => state.setBaseUrl);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [server, setServer] = useState(baseUrl);
  const [registering, setRegistering] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (status === 'signed_in') return <Redirect href="/today" />;

  const submit = async () => {
    try {
      if (server !== baseUrl) await setBaseUrl(server);
      if (registering) await register(email.trim(), password, nickname.trim());
      else await login(email.trim(), password);
      if (authStore.getState().status === 'signed_in') router.replace('/today');
    } catch {
      return;
    }
  };
  const disabledReason = !server.trim() ? '请先在高级服务器设置中填写 API 地址' : !email.trim() ? '请输入邮箱' : password.length < 8 ? '密码至少 8 位' : registering && !nickname.trim() ? '请输入昵称' : null;

  return <Screen><PageHeader title="LoopTodo" description="登录后进入今日任务，建立可持续的专注闭环。" /><Card><Card.Body className="gap-4"><View><Card.Title>{registering ? '创建账号' : '欢迎回来'}</Card.Title><Card.Description>{registering ? '注册后会自动登录。' : '使用 LoopTodo 账号继续。'}</Card.Description></View><TextField><Label>邮箱</Label><Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" /></TextField><TextField><Label>密码</Label><Input value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} textContentType={registering ? 'newPassword' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} placeholder="至少 8 位" /></TextField><Button variant="secondary" size="sm" onPress={() => setShowPassword((value) => !value)}>{showPassword ? '隐藏密码' : '显示密码'}</Button>{registering ? <TextField><Label>昵称</Label><Input value={nickname} onChangeText={setNickname} placeholder="你的昵称" /></TextField> : null}<Button isDisabled={status === 'hydrating' || Boolean(disabledReason)} onPress={() => void submit()}>{status === 'hydrating' ? '处理中…' : registering ? '注册并登录' : '登录'}</Button>{disabledReason ? <Text type="body-xs" color="muted">{disabledReason}</Text> : null}<Button variant="secondary" onPress={() => setRegistering((value) => !value)}>{registering ? '已有账号，去登录' : '没有账号，去注册'}</Button>{error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}</Card.Body></Card><Card variant="secondary"><Card.Body className="gap-3"><Button variant="secondary" onPress={() => setAdvanced((value) => !value)}>{advanced ? '收起高级服务器设置' : '高级服务器设置'}</Button>{advanced ? <TextField><Label>API 地址</Label><Input value={server} onChangeText={setServer} autoCapitalize="none" placeholder="https://api.example.com" /></TextField> : null}</Card.Body></Card></Screen>;
}
