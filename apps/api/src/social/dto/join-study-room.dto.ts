import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
export class JoinStudyRoomDto { @IsOptional() @IsUUID('4') roomId?: string; @IsOptional() @IsString() @Length(6, 16) inviteCode?: string; }
