import type { Payment, SearchCriteria, Product, Service } from './types';
import type {
  AuthenticateResponse,
  CreatePaymentRequest,
  CreatePaymentResponse,
  GetPaymentResponse,
  SearchPaymentsResponse,
  PaymentNotificationRequest,
} from './types/dto';
import { generatePaymentSignature, verifyNotificationSignature } from './utils/signature';
import {
  PaynetSDKError,
  PaynetApiError,
  PaynetAuthenticationError,
  PaynetNetworkError,
  PaynetValidationError,
} from './errors';

export type {
  Payment,
  Customer,
  Product,
  Service,
  MoneyType,
  SearchCriteria,
  GetEcomFormData,
  SetEcomFormData,
} from './types';

export { PaymentStatus } from './types';

export type {
  AuthenticateResponse,
  AuthenticateRequest,
  CreatePaymentRequest,
  CreatePaymentResponse,
  GetPaymentResponse,
  SearchPaymentsResponse,
  PaymentNotificationRequest,
} from './types/dto';

export { generatePaymentSignature, verifyNotificationSignature } from './utils/signature';

export {
  PaynetSDKError as PaynetError,
  PaynetApiError,
  PaynetAuthenticationError,
  PaynetNetworkError,
  PaynetValidationError,
} from './errors';

export interface PaynetServerSDKConfig {
  /** API host URL (e.g. "https://api-merchant.test.paynet.md") */
  apiHost: string;
  /** Portal host URL (e.g. "https://test.paynet.md") */
  portalHost: string;
  /** Shared secret key for signature generation/verification */
  secretKey: string;
  /** Optional custom HTTP client (defaults to global fetch) */
  httpClient?: {
    fetch: typeof fetch;
  };
  /** Enable debug logging (defaults to false) */
  debug?: boolean;
}

export class PaynetServerSDK {
  private apiHost: string;
  private portalHost: string;
  private secretKey: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private httpClient: typeof fetch;
  private debug: boolean;
  private authUsername: string | null = null;
  private authPassword: string | null = null;

  constructor(config: PaynetServerSDKConfig) {
    this.apiHost = config.apiHost.replace(/\/$/, '');
    this.portalHost = config.portalHost.replace(/\/$/, '');
    this.secretKey = config.secretKey;
    this.httpClient = config.httpClient?.fetch ?? globalThis.fetch;
    this.debug = config.debug ?? false;
  }

  /**
   * Authenticates with Paynet API and obtains an OAuth2 bearer token
   */
  async authenticate(username: string, password: string): Promise<AuthenticateResponse> {
    this.authUsername = username;
    this.authPassword = password;

    const url = `${this.apiHost}/auth`;
    const body = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
    });

    let response: Response;
    try {
      response = await this.httpClient(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } catch (error) {
      throw new PaynetNetworkError('Authentication request failed', error);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => undefined);
      throw new PaynetAuthenticationError(
        'Authentication failed',
        response.status,
        response.statusText,
        errorBody
      );
    }

    const authResponse = (await response.json()) as AuthenticateResponse;
    this.accessToken = authResponse.access_token;
    this.tokenExpiresAt = Date.now() + (authResponse.expires_in - 5) * 1000;

    if (this.debug) {
      console.debug(
        '[PaynetSDK] Authenticated, token expires at:',
        new Date(this.tokenExpiresAt).toISOString()
      );
    }

    return authResponse;
  }

  /**
   * Sets the access token manually (useful if token is obtained externally)
   * @param token - The access token
   * @param expiresIn - Optional expiration time in seconds from now
   */
  setAccessToken(token: string, expiresIn?: number): void {
    this.accessToken = token;
    if (expiresIn !== undefined) {
      this.tokenExpiresAt = Date.now() + (expiresIn - 5) * 1000;
    } else {
      this.tokenExpiresAt = null;
    }
  }

  /**
   * Gets the current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Ensures we have a valid, non-expired access token, auto-reauthenticates if expired
   * @private
   */
  private async ensureToken(): Promise<string> {
    if (!this.accessToken) {
      if (this.authUsername && this.authPassword) {
        if (this.debug) {
          console.debug('[PaynetSDK] No token, re-authenticating...');
        }
        await this.authenticate(this.authUsername, this.authPassword);
      } else {
        throw new PaynetSDKError(
          'No access token available. Call authenticate() first or use setAccessToken().'
        );
      }
    }

    if (this.tokenExpiresAt !== null && Date.now() >= this.tokenExpiresAt) {
      if (this.authUsername && this.authPassword) {
        if (this.debug) {
          console.debug('[PaynetSDK] Token expired, re-authenticating...');
        }
        await this.authenticate(this.authUsername, this.authPassword);
      } else {
        throw new PaynetSDKError(
          'Access token has expired. Please call authenticate() again to obtain a new token.'
        );
      }
    }

    return this.accessToken!;
  }

  /**
   * Registers a new payment with Paynet (server->server flow)
   * Calculates service amounts from products if needed
   * @returns Payment domain model
   */
  async createPayment(payment: Payment): Promise<Payment> {
    const url = `${this.apiHost}/api/Payments/Send`;
    const token = await this.ensureToken();

    // API typo
    const LinkUrlSucces = payment.LinkUrlSucces || payment.LinkUrlSuccess;

    const paymentData: CreatePaymentRequest = {
      ...payment,
      ...(LinkUrlSucces && { LinkUrlSucces }),
      Invoice: payment.ExternalID || payment.Invoice,
      Services: payment.Services.map((service) => this.mapServiceToDTO(service)),
    };

    if (this.debug) {
      console.debug('[PaynetSDK] CreatePayment request:', JSON.stringify(paymentData, null, 2));
    }

    let response: Response;
    try {
      response = await this.httpClient(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });
    } catch (error) {
      throw new PaynetNetworkError('Payment creation request failed', error);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => undefined);
      throw new PaynetApiError(
        'Payment creation failed',
        response.status,
        response.statusText,
        errorBody
      );
    }

    const result = (await response.json()) as CreatePaymentResponse;

    if (this.debug) {
      console.debug('[PaynetSDK] CreatePayment response:', JSON.stringify(result, null, 2));
    }

    if (result.Code) {
      throw new PaynetApiError(
        result.Message || `Payment creation failed with code: ${result.Code}`,
        response.status,
        response.statusText,
        JSON.stringify(result)
      );
    }

    return result as Payment;
  }

  /**
   * Retrieves payment status and details by Paynet PaymentID
   * @returns Payment domain model
   */
  async getPayment(paymentId: number): Promise<Payment> {
    const url = `${this.apiHost}/api/Payments/${paymentId}`;
    const token = await this.ensureToken();

    let response: Response;
    try {
      response = await this.httpClient(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      throw new PaynetNetworkError('Payment retrieval request failed', error);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => undefined);
      if (response.status === 404) {
        throw new PaynetApiError(
          `Payment not found: ${paymentId}`,
          response.status,
          response.statusText,
          errorBody
        );
      }
      throw new PaynetApiError(
        'Payment retrieval failed',
        response.status,
        response.statusText,
        errorBody
      );
    }

    const result = (await response.json()) as GetPaymentResponse;

    if (this.debug) {
      console.debug('[PaynetSDK] GetPayment response:', JSON.stringify(result, null, 2));
    }

    return result as Payment;
  }

  /**
   * Searches payments by criteria (Invoice, date range, etc.)
   * @returns Array of Payment domain models
   */
  async searchPayments(criteria: SearchCriteria): Promise<Payment[]> {
    const params = new URLSearchParams();

    if (criteria.Invoice !== undefined) {
      params.append('Invoice', String(criteria.Invoice));
    }
    if (criteria.from) {
      params.append('from', criteria.from);
    }
    if (criteria.to) {
      params.append('to', criteria.to);
    }

    const queryString = params.toString();
    const url = `${this.apiHost}/api/Payments${queryString ? `?${queryString}` : ''}`;
    const token = await this.ensureToken();

    let response: Response;
    try {
      response = await this.httpClient(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      throw new PaynetNetworkError('Payment search request failed', error);
    }

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const errorBody = await response.text().catch(() => undefined);
      throw new PaynetApiError(
        'Payment search failed',
        response.status,
        response.statusText,
        errorBody
      );
    }

    const result = (await response.json()) as SearchPaymentsResponse | GetPaymentResponse;

    if (this.debug) {
      console.debug('[PaynetSDK] SearchPayments response:', JSON.stringify(result, null, 2));
    }

    const payments = Array.isArray(result) ? result : result ? [result] : [];
    return payments as Payment[];
  }

  /**
   * Verifies the signature of an incoming payment notification
   */
  verifyNotificationSignature(notification: PaymentNotificationRequest): boolean {
    return verifyNotificationSignature(notification, this.secretKey);
  }

  /**
   * Calculates service amount from products if not provided
   * @private
   */
  private mapServiceToDTO(service: Service): Service {
    let serviceAmount = service.Amount ?? 0;

    if (service.Products && service.Products.length > 0) {
      const calculatedAmount = service.Products.reduce((sum, product) => {
        if (product.TotalAmount != null) return sum + product.TotalAmount;
        if (product.Amount != null) return sum + product.Amount;
        const quantity = product.Quantity ?? (product.UnitProduct ? product.UnitProduct / 100 : 1);
        const unitPrice = product.UnitPrice ?? 0;
        return sum + quantity * unitPrice;
      }, 0);

      if (!service.Amount) {
        serviceAmount = calculatedAmount;
      }
    }

    return {
      Name: service.Name,
      Description: service.Description,
      Amount: serviceAmount,
      Products:
        service.Products?.map((product, index) => this.mapProductToDTO(product, index)) ?? [],
    };
  }

  /**
   * Maps product to DTO format
   * @private
   */
  private mapProductToDTO(product: Product, index: number = 1): Product {
    return {
      ...product,
      LineNo: product.LineNo ?? index + 1,
    };
  }

  /**
   * Generates a payment signature (for client->server flow)
   */
  generatePaymentSignature(payment: Payment): string {
    return generatePaymentSignature(payment, this.secretKey);
  }

  /**
   * Builds HTML form for server-to-server flow (GetEcom)
   * Returns the form HTML string
   */
  buildGetEcomForm(
    payment: Payment,
    successUrl: string,
    cancelUrl: string,
    lang: string = 'en-US'
  ): string {
    const paymentId = payment.PaymentID || payment.PaymentId;
    if (!paymentId) {
      throw new PaynetValidationError('Payment must have a PaymentID for GetEcom flow');
    }
    if (!payment.Signature) {
      throw new PaynetValidationError('Payment must have a Signature for GetEcom flow');
    }

    const formData: Record<string, unknown> = {
      operation: paymentId,
      LinkUrlSucces: successUrl, // API typo
      LinkUrlCancel: cancelUrl,
      ExpiryDate: payment.ExpiryDate,
      Lang: lang,
      Signature: payment.Signature,
    };

    return this.buildForm(`${this.portalHost}/Acquiring/GetEcom`, formData);
  }

  /**
   * Builds HTML form for client-to-server flow (SetEcom)
   * Returns the form HTML string
   */
  buildSetEcomForm(
    payment: Payment,
    successUrl: string,
    cancelUrl: string,
    lang: string = 'en-US'
  ): string {
    if (!payment.Signature) {
      payment.Signature = generatePaymentSignature(payment, this.secretKey);
    }
    if (!payment.SignVersion) {
      payment.SignVersion = 'v05';
    }

    const formData: Record<string, any> = {
      ExternalID: payment.ExternalID || payment.Invoice,
      Merchant: payment.MerchantCode,
      Currency: payment.Currency,
      ExpiryDate: payment.ExpiryDate,
      ExternalDate: payment.ExternalDate,
      Customer: this.flattenObject(payment.Customer, 'Customer'),
      Services: this.flattenArray(payment.Services, 'Services'),
      LinkUrlSucces: successUrl, // API typo - required for Paynet
      LinkUrlSuccess: successUrl, // Correct spelling - for compatibility
      LinkUrlCancel: cancelUrl,
      Lang: lang,
      SignVersion: payment.SignVersion,
      Signature: payment.Signature,
    };

    if (payment.MoneyType) {
      formData.MoneyType = this.flattenObject(payment.MoneyType, 'MoneyType');
    }
    if (payment.Payer) {
      formData.Payer = this.flattenObject(payment.Payer, 'Payer');
    }
    if (payment.SaleAreaCode) {
      formData.SaleAreaCode = payment.SaleAreaCode;
    }

    return this.buildForm(`${this.portalHost}/Acquiring/SetEcom`, formData);
  }

  /**
   * Builds HTML form from data object
   * @private
   */
  private buildForm(action: string, data: Record<string, any>): string {
    let form = `<form id="paynet-form" method="POST" action="${this.escapeHtml(action)}">\n`;

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            for (const [subKey, subValue] of Object.entries(item)) {
              if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
                for (const [nestedKey, nestedValue] of Object.entries(subValue)) {
                  form += `  <input type="hidden" name="${this.escapeHtml(key)}[${index}].${this.escapeHtml(subKey)}.${this.escapeHtml(nestedKey)}" value="${this.escapeHtml(String(nestedValue))}">\n`;
                }
              } else {
                form += `  <input type="hidden" name="${this.escapeHtml(key)}[${index}].${this.escapeHtml(subKey)}" value="${this.escapeHtml(String(subValue))}">\n`;
              }
            }
          } else {
            form += `  <input type="hidden" name="${this.escapeHtml(key)}[${index}]" value="${this.escapeHtml(String(item))}">\n`;
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
            for (const [nestedKey, nestedValue] of Object.entries(subValue)) {
              form += `  <input type="hidden" name="${this.escapeHtml(key)}.${this.escapeHtml(subKey)}.${this.escapeHtml(nestedKey)}" value="${this.escapeHtml(String(nestedValue))}">\n`;
            }
          } else {
            form += `  <input type="hidden" name="${this.escapeHtml(key)}.${this.escapeHtml(subKey)}" value="${this.escapeHtml(String(subValue))}">\n`;
          }
        }
      } else {
        form += `  <input type="hidden" name="${this.escapeHtml(key)}" value="${this.escapeHtml(String(value))}">\n`;
      }
    }

    form += '</form>';
    return form;
  }

  /**
   * Flattens an object for form submission
   * @private
   */
  private flattenObject(obj: Record<string, any>, prefix: string): Record<string, any> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        result[`${prefix}.${key}`] = value;
      }
    }
    return result;
  }

  /**
   * Flattens an array for form submission
   * @private
   */
  private flattenArray(arr: any[], prefix: string): any[] {
    return arr.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        const flattened: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(item)) {
          flattened[`${prefix}[${index}].${key}`] = value;
        }
        return flattened;
      }
      return item;
    });
  }

  /**
   * Escapes HTML special characters
   * @private
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m] ?? m);
  }
}
