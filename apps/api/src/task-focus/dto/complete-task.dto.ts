import { IsInt, Min } from 'class-validator';

export class CompleteTaskDto {
  @IsInt()
  @Min(1)
  version!: number;
}
