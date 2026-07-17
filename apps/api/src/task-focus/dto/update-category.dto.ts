import { IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

export class UpdateCategoryDto {
  @IsInt() @Min(1) version!: number;
  @IsString() @Length(1, 80) name!: string;
  @IsOptional() @IsString() @MaxLength(32) color?: string | null;
}
