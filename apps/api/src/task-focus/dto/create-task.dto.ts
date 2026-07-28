import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

export class CreateTaskDto {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsString() @Length(1, 240) title!: string;
  @IsIn(['pomodoro', 'goal']) taskType!: 'pomodoro' | 'goal';
  @IsIn(['countdown', 'countup', 'untimed']) timerMode!: 'countdown' | 'countup' | 'untimed';
  @IsInt() @Min(1) @Max(180) estimatedMinutes!: number;
  @IsInt() @Min(0) @Max(180) restMinutes = 5;
  @IsOptional() @IsDateString() deadlineAt?: string;
  @IsOptional() @IsNumber() @Min(0.01) targetAmount?: number;
  @IsOptional() @IsString() @Length(1, 40) targetUnit?: string;
  @IsOptional() @IsBoolean() isTodayRequired = false;
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) forcedTriggerTime?: string;
  @IsOptional() @IsIn(['none', 'whitelist', 'strict']) restrictionMode?: 'none' | 'whitelist' | 'strict';
  @IsOptional() @IsIn(['inherit', 'list', 'custom']) whitelistMode?: 'inherit' | 'list' | 'custom';
  @IsOptional() @IsUUID() whitelistListId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) whitelistPackages?: string[];
}
