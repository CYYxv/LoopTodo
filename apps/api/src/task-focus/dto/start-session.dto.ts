import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

import type { WhitelistSource } from '../task-focus.types';

export class StartSessionDto {
  @IsOptional() @IsUUID() sessionId?: string;
  @IsOptional() @IsDateString() startedAt?: string;
  @IsOptional() @IsInt() @Min(1) @Max(180) plannedMinutes?: number;
  @IsOptional() @IsIn(['none', 'whitelist', 'strict']) restrictionMode?: 'none' | 'whitelist' | 'strict';
  @IsOptional() @IsString() @MaxLength(160) @Matches(/^(?:none|strict|custom|list:.+)$/) whitelistSource?: WhitelistSource;
  @IsOptional() @IsBoolean() restrictionEffective?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) allowedPackagesSnapshot?: string[];
  @IsOptional()
  @IsIn(['high', 'normal', 'open', 'invalid'])
  trustLevel: 'high' | 'normal' | 'open' | 'invalid' = 'normal';
}
