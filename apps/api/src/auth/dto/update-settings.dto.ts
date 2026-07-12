import { IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() multiDeviceFocusSync?: boolean;
  @IsOptional() @IsObject() privacySettings?: Record<string, unknown>;
  @IsOptional() @IsBoolean() socialEnabled?: boolean;
  @IsOptional() @IsBoolean() shareCurrentTask?: boolean;
  @IsOptional() @IsBoolean() shareCompletedTasks?: boolean;
  @IsOptional() @IsIn(['offline_first', 'online_required']) networkPolicy?: 'offline_first' | 'online_required';
  @IsOptional() @IsBoolean() taskRemindersEnabled?: boolean;
  @IsOptional() @IsBoolean() familyAlertsEnabled?: boolean;
  @IsOptional() @IsBoolean() rewardNotificationsEnabled?: boolean;
}
