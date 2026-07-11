import type { StrictOption } from '@/modules/focus-session/focus-session.types';

import type { Task } from './task.types';

export const prototypeTasks: Task[] = [
  {
    id: 'task-math-review',
    title: '数学套卷错题复盘',
    category: '学习',
    kind: 'goal',
    estimateMinutes: 50,
    progressLabel: '目标 2 套 / 已完成 0.5 套',
    mustDo: true,
    trustLevel: 'high',
    status: 'pending',
  },
  {
    id: 'task-weekly-report',
    title: '整理周报素材',
    category: '办公',
    kind: 'pomodoro',
    estimateMinutes: 35,
    progressLabel: '普通番茄钟 · 倒计时',
    mustDo: false,
    trustLevel: 'medium',
    status: 'pending',
  },
  {
    id: 'task-english-listening',
    title: '英语听力精听',
    category: '习惯',
    kind: 'pomodoro',
    estimateMinutes: 25,
    progressLabel: '本地音频资源通行证',
    mustDo: true,
    trustLevel: 'high',
    status: 'pending',
  },
];

export const prototypeStrictOptions: StrictOption[] = [
  {
    id: 'whitelist',
    label: '只允许任务白名单',
    description: '浏览器、B 站、AI 等高风险应用会降低可信分',
    enabled: true,
  },
  {
    id: 'notification',
    label: '拦截通知',
    description: '专注期间不让消息流把注意力拉走',
    enabled: true,
  },
  {
    id: 'recents',
    label: '隐藏多任务与桌面图标',
    description: '降低被手动杀进程或卸载绕过的概率',
    enabled: false,
  },
];
