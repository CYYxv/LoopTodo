import { IsIn, IsOptional } from 'class-validator';

export class StartSessionDto {
  @IsOptional()
  @IsIn(['high', 'normal', 'open', 'invalid'])
  trustLevel: 'high' | 'normal' | 'open' | 'invalid' = 'normal';
}
