import { ArrayMaxSize, IsArray, IsString, IsUUID, Length } from 'class-validator';

export class AskTaskAiDto {
  @IsString() @Length(1, 2000) question!: string;
  @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) materialIds!: string[];
}
