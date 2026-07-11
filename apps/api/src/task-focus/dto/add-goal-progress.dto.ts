import { IsInt, IsNumber, Min } from 'class-validator';

export class AddGoalProgressDto {
  @IsInt() @Min(1) version!: number;
  @IsNumber() @Min(0.01) amount!: number;
}
