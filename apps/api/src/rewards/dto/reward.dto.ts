import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, IsUUID, Length, Min } from 'class-validator';
export class CreateRewardDto { @IsString() @Length(1, 160) name!: string; @IsString() @Length(1, 4000) description!: string; @IsIn(['virtual', 'physical']) rewardType!: 'virtual' | 'physical'; @IsOptional() @IsUrl() imageUrl?: string; @IsOptional() @IsInt() @Min(0) inventory?: number; @IsOptional() @IsObject() config?: Record<string, unknown>; }
export class GrantRewardDto { @IsUUID('4') userId!: string; }
export class AcceptRewardDto { @IsBoolean() accept!: boolean; }
export class RewardAddressDto { @IsString() @Length(2, 80) recipient!: string; @IsString() @Length(6, 30) phone!: string; @IsString() @Length(5, 500) address!: string; }
