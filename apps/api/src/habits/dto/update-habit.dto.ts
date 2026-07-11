import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class UpdateHabitDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1440) targetMinutes?: number;
  @IsOptional() @IsBoolean() forceEnabled?: boolean;
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) triggerTime?: string | null;
}
