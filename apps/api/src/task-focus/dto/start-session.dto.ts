import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class StartSessionDto {
  @IsOptional() @IsUUID() sessionId?: string;
  @IsOptional() @IsDateString() startedAt?: string;
  @IsOptional() @IsInt() @Min(1) @Max(180) plannedMinutes?: number;
  @IsOptional()
  @IsIn(['high', 'normal', 'open', 'invalid'])
  trustLevel: 'high' | 'normal' | 'open' | 'invalid' = 'normal';
}
