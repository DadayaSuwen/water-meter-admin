import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class WxLoginDTO {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: '用户名至少2个字符' })
  @MaxLength(50, { message: '用户名最多50个字符' })
  username?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class AdminLoginDTO {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}

export class UpdateAvatarDTO {
  @IsString()
  @IsNotEmpty()
  avatar: string;
}

export class UpdateProfileDTO {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '用户名至少2个字符' })
  @MaxLength(50, { message: '用户名最多50个字符' })
  username?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
