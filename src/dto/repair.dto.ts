import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum, IsArray, MinLength, MaxLength } from 'class-validator';

export class CreateTicketDTO {
  @IsUUID('4', { message: '水表ID格式不正确' })
  @IsNotEmpty({ message: '水表ID不能为空' })
  meterId: string;

  @IsString()
  @IsNotEmpty({ message: '问题描述不能为空' })
  @MinLength(5, { message: '问题描述至少5个字符' })
  @MaxLength(2000, { message: '问题描述最多2000字符' })
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class UpdateTicketDTO {
  @IsEnum(['PROCESSING', 'COMPLETED'], {
    message: '状态必须是PROCESSING或COMPLETED'
  })
  status: 'PROCESSING' | 'COMPLETED';

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: '处理备注最多1000字符' })
  remark?: string;
}