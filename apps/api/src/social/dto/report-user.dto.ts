import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReportUserDto {
  @IsUUID('4')
  targetUserId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}