import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum, MaxLength } from 'class-validator';

export class CreateBindingDTO {
  @IsString()
  @IsNotEmpty({ message: '水表序列号不能为空' })
  serialNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '申请说明最多500字符' })
  description?: string;
}

export class ReviewBindingDTO {
  @IsUUID('4', { message: '绑定ID格式不正确' })
  @IsNotEmpty({ message: '绑定ID不能为空' })
  bindingId: string;

  @IsEnum(['APPROVED', 'REJECTED'], {
    message: '状态必须是APPROVED或REJECTED'
  })
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: '审核备注最多1000字符' })
  remark?: string;
}