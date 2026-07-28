import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateWhitelistListDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @Length(1, 80) name?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) packages?: string[];
}
