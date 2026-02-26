import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

/**
 * Sent by the payment gateway / bank after the user scans the QR and pays.
 * The gateway echoes back the signed payload embedded in the QR.
 */
export class VerifyPaymentDto {
  /** The qrId embedded in the QR payload */
  @IsString()
  @IsNotEmpty()
  qrId: string;

  /** Nonce from the QR payload — used for idempotency */
  @IsString()
  @IsNotEmpty()
  nonce: string;

  /** Amount the gateway actually charged — must match QR amount */
  @IsNumber()
  @IsPositive()
  amount: number;

  /** HMAC signature from the QR payload — re-verified server-side */
  @IsString()
  @IsNotEmpty()
  signature: string;
}
