import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import type { WhitelistSource } from '../task-focus.types';

export class FinishSessionDto {
  @IsIn(['completed', 'failed', 'cancelled', 'emergency_exit'])
  outcome!: 'completed' | 'failed' | 'cancelled' | 'emergency_exit';

  @IsOptional() @IsDateString() endedAt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1440) actualMinutes?: number;
  @IsOptional() @IsIn(['none', 'whitelist', 'strict']) restrictionMode?: 'none' | 'whitelist' | 'strict';
  @IsOptional() @IsString() @MaxLength(160) @Matches(/^(?:none|strict|custom|list:.+)$/) whitelistSource?: WhitelistSource;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) whitelistPackageCount?: number;
  @IsOptional() @IsBoolean() restrictionEffective?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1440) effectiveMinutes?: number;

  @IsOptional() @IsString() @MaxLength(2000) completionNote?: string;
  @IsOptional() @IsString() @MaxLength(80) failureReasonType?: string;
  @IsOptional() @IsString() @MaxLength(2000) failureReasonText?: string;
}
