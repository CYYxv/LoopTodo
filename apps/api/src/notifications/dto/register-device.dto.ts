import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsIn(['android', 'ios']) platform!: 'android' | 'ios';
  @IsString() @MinLength(1) @MaxLength(120) deviceName!: string;
  @IsString() @MinLength(8) @MaxLength(512) pushToken!: string;
  @IsIn(['fcm', 'vendor', 'test']) provider!: 'fcm' | 'vendor' | 'test';
  @IsOptional() @IsString() @MaxLength(40) appVersion?: string;
}
