import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateHabitDto {
  @IsString() @Length(1, 120) name!: string;
  @IsInt() @Min(1) @Max(1440) targetMinutes!: number;
  @IsOptional() @IsBoolean() forceEnabled = false;
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) triggerTime?: string;
}
