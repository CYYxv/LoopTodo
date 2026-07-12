import { IsString, Length, MaxLength } from 'class-validator';

export class CreateAiMaterialDto {
  @IsString() @Length(1, 160) title!: string;
  @IsString() @Length(1, 50_000) content!: string;
}
