export type ResourcePassType = 'url' | 'domain' | 'local_video' | 'local_file';
export type ResourcePass = { id: string; taskId: string; type: ResourcePassType; value: string; displayName: string; valueHash: string; createdAt: number };
export type CreateResourcePass = Pick<ResourcePass, 'taskId' | 'type' | 'value' | 'displayName'>;
