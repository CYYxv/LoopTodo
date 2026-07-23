import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class UpdateTaskDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() @Length(1, 240) title?: string;
  @IsOptional() @IsIn(['countdown', 'countup', 'untimed']) timerMode?: 'countdown' | 'countup' | 'untimed';
  @IsOptional() @IsInt() @Min(1) @Max(180) estimatedMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(180) restMinutes?: number;
  @IsOptional() @IsDateString() deadlineAt?: string | null;
  @IsOptional() @IsNumber() @Min(0.01) targetAmount?: number | null;
  @IsOptional() @IsString() @Length(1, 40) targetUnit?: string | null;
  @IsOptional() @IsBoolean() isTodayRequired?: boolean;
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) forcedTriggerTime?: string | null;
  @IsOptional() @IsIn(['pending', 'completed', 'failed']) status?: 'pending' | 'completed' | 'failed';
  @IsOptional() @IsIn(['inherit', 'custom']) whitelistMode?: 'inherit' | 'custom';
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) whitelistPackages?: string[];
}
