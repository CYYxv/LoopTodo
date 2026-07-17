import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator';

import type { BottomTabKey } from '../auth.types';

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() multiDeviceFocusSync?: boolean;
  @IsOptional() @IsObject() privacySettings?: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(2) @ArrayUnique() @IsIn(['habits', 'statistics', 'social'], { each: true }) bottomTabs?: BottomTabKey[];
  @IsOptional() @IsBoolean() shareCurrentTask?: boolean;
  @IsOptional() @IsBoolean() shareCompletedTasks?: boolean;
  @IsOptional() @IsIn(['offline_first', 'online_required']) networkPolicy?: 'offline_first' | 'online_required';
  @IsOptional() @IsBoolean() taskRemindersEnabled?: boolean;
  @IsOptional() @IsBoolean() familyAlertsEnabled?: boolean;
  @IsOptional() @IsBoolean() rewardNotificationsEnabled?: boolean;
}
