import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateWhitelistListDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @Length(1, 80) name!: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) packages!: string[];
}
