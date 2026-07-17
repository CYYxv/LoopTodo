import { IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;
}
