import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class GenerateQrDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsIn(['USD', 'EUR', 'GBP', 'THB', 'JPY'])
  currency?: string;
}
