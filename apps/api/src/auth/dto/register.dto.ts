import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '请输入有效邮箱地址' })
  email!: string;

  @IsString()
  @Length(8, 128, { message: '密码长度必须为 8 到 128 位' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: '昵称不能超过 80 个字符' })
  nickname?: string;

  @IsString()
  @Length(1, 120, { message: '设备名称不能为空' })
  deviceName!: string;
}
