import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(10, 128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nickname?: string;

  @IsString()
  @Length(1, 120)
  deviceName!: string;
}
