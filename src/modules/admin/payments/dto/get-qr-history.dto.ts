import { IsOptional, IsIn, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentQrStatus } from '@/modules/shared/entities/payment-qr.entity';

const ALL_STATUSES = Object.values(PaymentQrStatus);

export class GetQrHistoryDto {
  @IsOptional()
  @IsIn(ALL_STATUSES)
  status?: PaymentQrStatus;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
