import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';

import { useTaskAiStore } from '../task-ai.store';
import type { AiMaterial } from '../task-ai.types';

const emptyMaterials: AiMaterial[] = [];

export function TaskAiPanel({ taskId, readOnly }: { taskId: string; readOnly: boolean }) {
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [question, setQuestion] = useState('');
  const configured = useTaskAiStore((state) => state.configured); const materials = useTaskAiStore((state) => state.materials[taskId] ?? emptyMaterials);
  const answer = useTaskAiStore((state) => state.answer); const loading = useTaskAiStore((state) => state.loading); const error = useTaskAiStore((state) => state.error);
  const load = useTaskAiStore((state) => state.load); const addMaterial = useTaskAiStore((state) => state.addMaterial); const ask = useTaskAiStore((state) => state.ask);
  useEffect(() => { if (configured) void load(taskId); }, [configured, load, taskId]);
  return <Card><Card.Body className="gap-3"><View className="flex-row items-center justify-between"><View><Card.Title>任务型 AI</Card.Title><Card.Description>只使用当前任务和已批准材料</Card.Description></View><Chip color={configured ? 'success' : 'warning'} variant="soft">{configured ? '已连接' : '登录后启用'}</Chip></View>
    {!readOnly ? <><TextField><Label>材料标题</Label><Input value={title} onChangeText={setTitle} placeholder="例如：物理讲义第三章" /></TextField><TextField><Label>材料内容</Label><Input value={content} onChangeText={setContent} multiline numberOfLines={5} placeholder="粘贴与任务直接相关的材料" /></TextField><Button size="sm" isDisabled={!title.trim() || !content.trim()} onPress={() => void addMaterial(taskId, title, content)}>批准 AI 材料</Button></> : null}
    <Text type="body-xs" color="muted">已批准 {materials.length} 份材料；问题与回答仅记录 SHA-256 审计摘要。</Text>
    {readOnly ? <><TextField><Label>围绕任务提问</Label><Input value={question} onChangeText={setQuestion} multiline numberOfLines={3} placeholder="请解释材料中的关键步骤" /></TextField><Button size="sm" isDisabled={!configured || loading || !question.trim()} onPress={() => void ask(taskId, question)}>{loading ? '回答中…' : '基于材料回答'}</Button></> : null}
    {error ? <Text type="body-xs">{error}</Text> : null}{answer ? <View className="gap-2 rounded-panel-inner bg-surface-secondary p-3"><Text type="body-sm">{answer.answer}</Text>{answer.warning ? <Text type="body-xs">⚠ {answer.warning}</Text> : null}<Text type="body-xs" color="muted">provider: {answer.provider}</Text></View> : null}
  </Card.Body></Card>;
}
