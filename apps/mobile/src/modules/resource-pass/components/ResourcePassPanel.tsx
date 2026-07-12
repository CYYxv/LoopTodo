import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { Text } from 'heroui-native/text';
import { TextField } from 'heroui-native/text-field';

import { pickLocalResource } from '../document-picker.adapter';
import { useResourcePassStore } from '../resource-pass.store';
import type { ResourcePass, ResourcePassType } from '../resource-pass.types';
import { LocalVideoPlayer } from './LocalVideoPlayer';
import { RestrictedWebView } from './RestrictedWebView';

export function ResourcePassPanel({ taskId, readOnly = false }: { taskId: string | null; readOnly?: boolean }) {
  const [webType, setWebType] = useState<'url' | 'domain'>('url'); const [value, setValue] = useState(''); const [active, setActive] = useState<ResourcePass | null>(null);
  const resources = useResourcePassStore((state) => taskId ? state.byTask[taskId] ?? [] : []);
  const error = useResourcePassStore((state) => state.error); const load = useResourcePassStore((state) => state.load);
  const add = useResourcePassStore((state) => state.add); const remove = useResourcePassStore((state) => state.remove);
  useEffect(() => { if (taskId) void load(taskId); }, [load, taskId]);
  if (!taskId) return <Card variant="secondary"><Card.Body><Card.Title>任务资源通行证</Card.Title><Card.Description>先选择任务，再添加可信资源。</Card.Description></Card.Body></Card>;
  const addWeb = async () => { await add({ taskId, type: webType, value, displayName: value }); setValue(''); };
  const pick = async (type: 'local_video' | 'local_file') => { const asset = await pickLocalResource(type); if (asset) await add({ taskId, type, ...asset }); };
  return <Card variant="secondary"><Card.Body className="gap-3"><View><Card.Title>任务资源通行证</Card.Title><Card.Description>{readOnly ? '专注中只读，不能临时扩展白名单' : '开始前批准资源；专注中无法修改'}</Card.Description></View>
    {!readOnly ? <><View className="flex-row gap-2"><Button size="sm" variant={webType === 'url' ? 'primary' : 'secondary'} onPress={() => setWebType('url')}>精确页面</Button><Button size="sm" variant={webType === 'domain' ? 'primary' : 'secondary'} onPress={() => setWebType('domain')}>整个域名</Button></View><TextField><Label>HTTPS 地址</Label><Input value={value} onChangeText={setValue} placeholder="https://example.com/material" /></TextField><View className="flex-row flex-wrap gap-2"><Button size="sm" isDisabled={!value.trim()} onPress={() => void addWeb()}>批准网页</Button><Button size="sm" variant="secondary" onPress={() => void pick('local_video')}>选择本地视频</Button><Button size="sm" variant="secondary" onPress={() => void pick('local_file')}>选择本地文件</Button></View></> : null}
    {error ? <Text type="body-xs">{error}</Text> : null}
    {resources.map((resource) => <View key={resource.id} className="flex-row items-center justify-between gap-2"><View className="flex-1"><Text type="body-sm">{resource.displayName}</Text><Text type="body-xs" color="muted">{label(resource.type)} · {resource.valueHash}</Text></View><Button size="sm" variant="secondary" onPress={() => setActive(resource)}>打开</Button>{!readOnly ? <Text type="body-xs" onPress={() => void remove(taskId, resource.id)}>删除</Text> : null}</View>)}
    {resources.length === 0 ? <Text type="body-xs" color="muted">尚未批准资源</Text> : null}
    {active ? <View className="gap-2"><View className="flex-row items-center justify-between"><Chip variant="soft">只读容器</Chip><Text type="body-xs" onPress={() => setActive(null)}>关闭</Text></View>{active.type === 'url' || active.type === 'domain' ? <RestrictedWebView resource={active} /> : active.type === 'local_video' ? <LocalVideoPlayer uri={active.value} /> : <Text type="body-sm">本地文件已固定保存；当前版本不调用外部应用打开，避免离开专注环境。</Text>}</View> : null}
  </Card.Body></Card>;
}
function label(type: ResourcePassType) { return { url: '精确网页', domain: '域名', local_video: '本地视频', local_file: '本地文件' }[type]; }
