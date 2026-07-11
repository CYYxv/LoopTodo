import type { StrictOption } from '@/modules/focus-session/focus-session.types';

import type { Task } from './task.types';

export const prototypeTasks: Task[] = [
  {
    id: 'task-math-review',
    title: '数学套卷错题复盘',
    category: '学习',
    kind: 'goal',
    timerMode: 'countdown',
    estimateMinutes: 50,
    restMinutes: 5,
    deadlineAt: Date.parse('2026-07-31T23:59:59+08:00'),
    targetAmount: 2,
    targetUnit: '套',
    completedAmount: 0.5,
    progressLabel: '目标 0.5/2 套 · 单次 50 分钟',
    mustDo: true,
    trustLevel: 'high',
    status: 'pending',
  },
  {
    id: 'task-weekly-report',
    title: '整理周报素材',
    category: '办公',
    kind: 'pomodoro',
    timerMode: 'countdown',
    estimateMinutes: 35,
    restMinutes: 5,
    deadlineAt: null,
    targetAmount: null,
    targetUnit: null,
    completedAmount: 0,
    progressLabel: '倒计时 35 分钟 · 休息 5 分钟',
    mustDo: false,
    trustLevel: 'medium',
    status: 'pending',
  },
  {
    id: 'task-english-listening',
    title: '英语听力精听',
    category: '习惯',
    kind: 'pomodoro',
    timerMode: 'countdown',
    estimateMinutes: 25,
    restMinutes: 5,
    deadlineAt: null,
    targetAmount: null,
    targetUnit: null,
    completedAmount: 0,
    progressLabel: '倒计时 25 分钟 · 休息 5 分钟',
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
