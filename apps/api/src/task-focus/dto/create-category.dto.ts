import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;
}
