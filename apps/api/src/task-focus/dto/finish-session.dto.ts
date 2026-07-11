import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class FinishSessionDto {
  @IsIn(['completed', 'failed', 'cancelled', 'emergency_exit'])
  outcome!: 'completed' | 'failed' | 'cancelled' | 'emergency_exit';

  @IsOptional() @IsString() @MaxLength(2000) completionNote?: string;
  @IsOptional() @IsString() @MaxLength(80) failureReasonType?: string;
  @IsOptional() @IsString() @MaxLength(2000) failureReasonText?: string;
}
