export type Friend = { id: string; status: 'pending' | 'accepted' | 'blocked'; direction: 'incoming' | 'outgoing'; user: { id: string; nickname: string; avatarUrl: string | null }; createdAt: string };
export type PkMatch = { id: string; status: string; date: string; challenger: { id: string; nickname: string; minutes: number }; opponent: { id: string; nickname: string; minutes: number } };
export type StudyRoom = { id: string; name: string; visibility: 'public' | 'private'; inviteCode: string | null; memberCount: number; joined: boolean };
export type RoomReaction = { roomId: string; emoji: string; nickname: string; createdAt: string };
