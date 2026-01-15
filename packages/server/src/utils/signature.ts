import { createHash } from 'crypto';
import type { Payment } from '../types';
import type { PaymentNotificationRequest } from '../types/dto';

/**
 * Generates a signature for payment data (used in client->server flow)
 * Follows the exact field order specified in Paynet API v0.5
 */
export function generatePaymentSignature(payment: Payment, secretKey: string): string {
  const toString = (value: unknown) => (value == null ? '' : `${value}`);
  const str = [
    payment.Currency,
    payment.Customer.Address,
    payment.Customer.City,
    payment.Customer.Code,
    payment.Customer.Country,
    payment.Customer.email,
    payment.Customer.NameFirst,
    payment.Customer.NameLast,
    payment.Customer.PhoneNumber,
    payment.ExpiryDate,
    payment.Invoice,
    payment.MerchantCode,
    payment.MoneyType?.Code,
    ...(payment.Services ?? []).flatMap((svc) => [
      svc.Amount,
      svc.Description,
      svc.Name,
      ...(svc.Products ?? []).flatMap((prod) => [
        prod.Amount,
        prod.Barcode,
        prod.Code,
        prod.Description,
        prod.GroupId,
        prod.GroupName,
        prod.LineNo,
        prod.Name,
        prod.UnitPrice,
        prod.UnitProduct,
      ]),
    ]),
  ]
    .map(toString)
    .join('');

  const md5 = createHash('md5')
    .update(str + secretKey, 'utf8')
    .digest();
  return md5.toString('base64');
}

/**
 * Generates a signature for notification data (for verification).
 * Fields are concatenated in alphabetical order of field names.
 */
export function generateNotificationSignature(
  notification: PaymentNotificationRequest,
  secretKey: string
): string {
  const toString = (value: unknown) => (value == null ? '' : `${value}`);
  const str = [
    notification.EventDate,
    notification.EventID,
    notification.EventType,
    notification.Payment.Amount,
    notification.Payment.Customer,
    notification.Payment.ExternalID,
    notification.Payment.ID,
    notification.Payment.Merchant,
    notification.Payment.StatusDate,
  ]
    .map(toString)
    .join('');

  const md5 = createHash('md5')
    .update(str + secretKey, 'utf8')
    .digest();
  return md5.toString('base64');
}

/**
 * Verifies a notification signature
 */
export function verifyNotificationSignature(
  notification: PaymentNotificationRequest,
  secretKey: string
): boolean {
  const computedSignature = generateNotificationSignature(notification, secretKey);
  return computedSignature === notification.Signature;
}
