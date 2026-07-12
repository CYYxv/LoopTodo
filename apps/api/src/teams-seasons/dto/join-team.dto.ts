import { IsString, Length } from 'class-validator';
export class JoinTeamDto { @IsString() @Length(6, 16) joinCode!: string; }
