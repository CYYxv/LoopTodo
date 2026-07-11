import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class FinishSessionDto {
  @IsIn(['completed', 'failed', 'cancelled', 'emergency_exit'])
  outcome!: 'completed' | 'failed' | 'cancelled' | 'emergency_exit';

  @IsOptional() @IsDateString() endedAt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1440) actualMinutes?: number;

  @IsOptional() @IsString() @MaxLength(2000) completionNote?: string;
  @IsOptional() @IsString() @MaxLength(80) failureReasonType?: string;
  @IsOptional() @IsString() @MaxLength(2000) failureReasonText?: string;
}
