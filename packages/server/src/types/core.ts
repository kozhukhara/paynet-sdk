/**
 * Core domain types and interfaces for Paynet SDK
 */

/**
 * Payment status codes as an enum
 */
export enum PaymentStatus {
  Registered = 1,
  CustomerVerified = 2,
  Initialized = 3,
  Paid = 4,
}

/**
 * Customer information on partner side (as per Paynet spec)
 */
export interface Customer {
  /** Client code in partner system */
  Code: string;
  /** Client's full name */
  Name?: string;
  /** Client's first name */
  NameFirst?: string;
  /** Client's last name */
  NameLast?: string;
  /** Client's phone number */
  PhoneNumber?: string;
  /** Client's email address */
  email?: string;
  /** Client's country */
  Country?: string;
  /** Client's city */
  City?: string;
  /** Client's address */
  Address?: string;
}

/**
 * Product line item for a service
 */
export interface Product {
  /** Cost of the product in minor units (e.g. 12.34 -> 1234) */
  Amount?: number;
  /** Total amount for the product (alternative to Amount) */
  TotalAmount?: number;
  /** Product barcode/code (numeric) */
  Barcode?: number;
  /** Product code/SKU (string) */
  Code: string;
  /** Product name */
  Name: string;
  /** Product description (extended) */
  Description?: string;
  /** Product group ID */
  GroupId?: number;
  /** Product group name (if applicable) */
  GroupName?: string;
  /** Product line number in the list */
  LineNo?: number;
  /** Price per unit (minor units) */
  UnitPrice?: number;
  /** Quantity of product (in minor unit format or count) */
  UnitProduct?: number;
  /** Quantity of product (alternative to UnitProduct) */
  Quantity?: number;
  /** Qualities concatenated */
  QualitiesConcat?: string;
  /** Product dimensions */
  Dimensions?: string;
  /** Product qualities */
  Qualities?: unknown;
}

/**
 * Service item in the payment, which can include multiple products
 */
export interface Service {
  /** Name of the service */
  Name: string;
  /** Description of the service */
  Description: string;
  /** Total amount for this service (minor units) */
  Amount?: number;
  /** List of products under this service */
  Products?: Product[];
}

/**
 * MoneyType representing the payment instrument code
 */
export interface MoneyType {
  /** Code of the payment instrument (e.g. "PAYNET") */
  Code: string;
}

/**
 * Domain model for Payment (used internally, not for API requests/responses)
 * For API types, use CreatePaymentRequest and GetPaymentResponse
 */
export interface Payment {
  /** Paynet Payment ID (assigned upon registration) */
  PaymentID?: number;
  /** Alternative field name (capital I) used in API responses */
  PaymentId?: number;
  /** Partner's Payment ID (external invoice) */
  Invoice: number;
  /** Alternative field name for Invoice */
  ExternalID?: number;
  /** Merchant code in Paynet system */
  MerchantCode: string;
  /** Partner site/area code (can be empty) */
  SaleAreaCode?: string;
  /** Currency code (ISO 4217 numeric) */
  Currency: number;
  /** Payment expiration date/time (ISO 8601) */
  ExpiryDate: string;
  /** External date (ISO 8601) */
  ExternalDate?: string;
  /** Customer information object */
  Customer: Customer;
  /** Payer information (usually same as Customer) */
  Payer?: Customer;
  /** Array of services (with products) */
  Services: Service[];
  /** Payment instrument (if specified) */
  MoneyType?: MoneyType;
  /** Success redirect URL (for payment creation) - correct spelling */
  LinkUrlSuccess?: string;
  /** Success redirect URL (for payment creation) - API typo, kept for backward compatibility */
  LinkUrlSucces?: string;
  /** Cancel redirect URL (for payment creation) */
  LinkUrlCancel?: string;
  /** Language/locale (e.g. "en-US") */
  Lang?: string;
  /** Current status (if known) */
  Status?: PaymentStatus;
  /** Timestamp when registered (ISO 8601) */
  Registered?: string;
  /** Timestamp when customer confirmed details (ISO 8601) */
  Confirmed?: string;
  /** Timestamp when payment processed/paid (ISO 8601) */
  Processed?: string;
  /** Timestamp if payment was canceled (ISO 8601) */
  Canceled?: string;
  /** Signature hash of this payment (for client->server or returned by API) */
  Signature?: string;
  /** Signature version (e.g. "v05") */
  SignVersion?: string;
}

/**
 * Search criteria for querying payments
 */
export interface SearchCriteria {
  /** Search by partner's payment ID (external invoice) */
  Invoice?: number;
  /** Start of payment date range (ISO 8601 date-time) */
  from?: string;
  /** End of payment date range (ISO 8601 date-time) */
  to?: string;
}

/**
 * GetEcom form data for server-to-server flow
 */
export interface GetEcomFormData {
  /** Paynet PaymentID */
  operation: number;
  /** URL to redirect on cancel */
  LinkUrlCancel: string;
  /** URL to redirect on success - correct spelling */
  LinkUrlSuccess: string;
  /** URL to redirect on success - API typo, kept for backward compatibility */
  LinkUrlSucces?: string;
  /** Locale (e.g. "en-US") */
  Lang: string;
  /** Signature from payment registration */
  Signature: string;
}

/**
 * SetEcom form data for client-to-server flow
 */
export interface SetEcomFormData extends Payment {
  /** URL to redirect on cancel */
  LinkUrlCancel: string;
  /** URL to redirect on success - correct spelling */
  LinkUrlSuccess: string;
  /** URL to redirect on success - API typo, kept for backward compatibility */
  LinkUrlSucces?: string;
  /** Locale (e.g. "en-US") */
  Lang: string;
  /** Signature version (e.g. "v05") */
  SignVersion: string;
  /** Signature of payment data */
  Signature: string;
}
