export type FamilyMember = {
  id: string;
  role: 'parent' | 'child';
  user: { id: string; nickname: string };
};

export type FamilyGroupMembership = {
  id: string;
  role: 'parent' | 'child';
  familyGroup: { id: string; name: string; members: FamilyMember[] };
};

export type FamilyAssignment = {
  id: string;
  task: { id: string; title: string; estimatedMinutes?: number; status?: string };
  parentMember?: { user: { nickname: string } };
  changeRequests?: Array<{ id: string; status: string }>;
};

export type FamilyChangeRequest = {
  id: string;
  requestType?: 'update' | 'delete';
  reason: string;
  status?: string;
  assignment: { task: { title: string } };
  childMember: { user: { nickname: string } };
};

export type FamilyChildStatus = {
  childUserId: string;
  summary: {
    taskCount: number;
    activeFamilyTasks: number;
    sessionCount: number;
    currentState: string;
  };
  tasks: Array<Record<string, unknown>>;
  familyAssignments: Array<{
    id: string;
    taskId: string;
    title: string;
    status: string;
    isTodayRequired: boolean;
    triggerTime: string | null;
  }>;
  sessions: Array<{
    id: string;
    outcome: string | null;
    actualMinutes: number | null;
    completionNote?: string | null;
    failureReasonText?: string | null;
  }>;
  failures: Array<{
    id: string;
    outcome: string | null;
    reason: string;
  }>;
  activeSession: Record<string, unknown> | null;
};
