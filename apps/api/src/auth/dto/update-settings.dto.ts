import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() multiDeviceFocusSync?: boolean;
  @IsOptional() @IsObject() privacySettings?: Record<string, unknown>;
}
