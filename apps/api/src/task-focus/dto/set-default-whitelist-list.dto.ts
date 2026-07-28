import { IsInt, Min } from 'class-validator';

export class SetDefaultWhitelistListDto {
  @IsInt() @Min(1) version!: number;
}
