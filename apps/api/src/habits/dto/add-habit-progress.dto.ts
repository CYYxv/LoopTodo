import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AddHabitProgressDto {
  @IsInt() @Min(1) @Max(1440) minutes!: number;
  @IsOptional() @IsDateString() date?: string;
}
