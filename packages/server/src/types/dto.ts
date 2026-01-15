/**
 * DTOs for API requests and responses
 */

import type { Customer, Service, MoneyType, PaymentStatus } from './core';

/**
 * Request for creating a payment (POST /api/Payments/Send)
 */
export interface CreatePaymentRequest {
  Invoice: number;
  MerchantCode: string;
  SaleAreaCode?: string;
  Currency: number;
  /** ISO 8601 */
  ExpiryDate?: string;
  /** ISO 8601 */
  ExternalDate?: string;
  Customer: Customer;
  Payer?: Customer;
  Services: Service[];
  MoneyType?: MoneyType;
  LinkUrlSucces?: string;
  LinkUrlCancel?: string;
  Lang?: string;
  Signature?: string;
  SignVersion?: string;
}

/**
 * Response from payment creation (POST /api/Payments/Send)
 * May include error response structure
 */
export interface CreatePaymentResponse {
  /** Success response fields */
  PaymentID?: number;
  /** Alternative field name */
  PaymentId?: number;
  Invoice?: number;
  MerchantCode?: string;
  SaleAreaCode?: string;
  Currency?: number;
  ExpiryDate?: string;
  ExternalDate?: string;
  Customer?: Customer;
  Payer?: Customer;
  Services?: Service[];
  MoneyType?: MoneyType;
  Status?: PaymentStatus;
  Registered?: string;
  Confirmed?: string;
  Processed?: string;
  Canceled?: string;
  Signature?: string;
  SignVersion?: string;
  /** Error response fields */
  Code?: number | string;
  Message?: string;
}

/**
 * Response for getting a payment (GET /api/Payments/{PaymentID})
 */
export interface GetPaymentResponse {
  PaymentID?: number;
  /** Alternative field name */
  PaymentId?: number;
  Invoice: number;
  MerchantCode: string;
  SaleAreaCode?: string;
  Currency: number;
  ExpiryDate: string;
  ExternalDate?: string;
  Customer: Customer;
  Payer?: Customer;
  Services: Service[];
  MoneyType?: MoneyType;
  Status?: PaymentStatus;
  Registered?: string;
  Confirmed?: string;
  Processed?: string;
  Canceled?: string;
  Signature?: string;
  SignVersion?: string;
}

/**
 * Response for searching payments (GET /api/Payments?QueryString)
 */
export type SearchPaymentsResponse = GetPaymentResponse[];

/**
 * Request for authentication (POST /auth)
 */
export interface AuthenticateRequest {
  grant_type: 'password';
  username: string;
  password: string;
}

/**
 * Response for authentication (POST /auth)
 */
export interface AuthenticateResponse {
  access_token: string;
  /** e.g. "bearer" */
  token_type: string;
  expires_in: number;
}

/**
 * Request for webhook notification (POST /api/webhooks/paynet)
 */
export interface PaymentNotificationRequest {
  EventID: number;
  /** e.g. "PAID" */
  EventType: string;
  /** ISO 8601 */
  EventDate: string;
  Payment: {
    ID: number;
    ExternalID: number;
    Merchant: string;
    Customer: string;
    /** ISO 8601 */
    StatusDate: string;
    Amount: number;
  };
  Signature: string;
  SignVersion?: string;
}
