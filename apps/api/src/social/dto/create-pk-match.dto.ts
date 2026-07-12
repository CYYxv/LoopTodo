import { IsUUID } from 'class-validator';
export class CreatePkMatchDto { @IsUUID('4') friendUserId!: string; }
