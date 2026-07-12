import type { CreateResourcePass, ResourcePass } from './resource-pass.types';

export interface ResourcePassRepository {
  list(taskId: string): Promise<ResourcePass[]>;
  create(input: CreateResourcePass): Promise<ResourcePass>;
  remove(id: string): Promise<void>;
}
