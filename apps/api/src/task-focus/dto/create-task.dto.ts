import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateTaskDto {
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
}
