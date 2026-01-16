# Paynet TypeScript SDK

TypeScript SDK for Paynet API v0.5. Server-side SDK for managing payment flows.

**Note:** This SDK is based on Paynet API documentation. For official API specifications, refer to [paynet.md](https://paynet.md).

> ⚠️ **Warning:** Some parts of this package were "vibe-coded" and may require additional review and testing.

## Installation

```bash
npm install paynet-sdk
# or
pnpm add paynet-sdk
# or
yarn add paynet-sdk
```

## Requirements

- Node.js >= 18.0.0
- TypeScript 5.x (for TypeScript projects)

## Quick Start

```typescript
import { PaynetServerSDK } from 'paynet-sdk';

const sdk = new PaynetServerSDK({
  apiHost: 'https://api-merchant.test.paynet.md',
  portalHost: 'https://test.paynet.md',
  secretKey: '550e8400-e29b-41d4-a716-446655440000',
  debug: true, // optional
});

// Authenticate
await sdk.authenticate('username', 'password');

// Create a payment
const payment = await sdk.createPayment({
  Invoice: 12345,
  MerchantCode: '123456',
  Currency: 498, // MDL
  ExpiryDate: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
  Customer: {
    Code: 'CUST001',
    Name: 'John Doe',
    PhoneNumber: '+37360123456',
    email: 'customer@example.com',
  },
  Services: [
    {
      Name: 'Product Purchase',
      Description: 'Payment for order #12345',
      Amount: 100000, // in minor units (1000.00 MDL)
      Products: [
        {
          Code: 'PROD001',
          Name: 'Product Name',
          Amount: 100000,
          Quantity: 1,
        },
      ],
    },
  ],
});

console.log('Payment created:', payment.PaymentID);
```

## Usage Examples

### Authentication

```typescript
// Basic authentication
const authResponse = await sdk.authenticate('123456', 'password');
console.log('Token expires in:', authResponse.expires_in, 'seconds');

// Manual token setting (if obtained externally)
sdk.setAccessToken('your-token-here', 3600); // expires in 1 hour

// Get current token
const token = sdk.getAccessToken();
```

### Create Payment (Server-to-Server Flow)

```typescript
const payment = await sdk.createPayment({
  Invoice: 12345,
  MerchantCode: '123456',
  Currency: 498, // MDL
  ExternalDate: new Date().toISOString(),
  ExpiryDate: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
  Customer: {
    Code: 'CUST001',
    NameFirst: 'John',
    NameLast: 'Doe',
    PhoneNumber: '+37360123456',
    email: 'john@example.com',
    Country: 'MD',
    City: 'Chisinau',
    Address: '123 Main St',
  },
  Services: [
    {
      Name: 'Service Name',
      Description: 'Service description',
      Amount: 50000, // Amount can be omitted if Products are provided
      Products: [
        {
          Code: 'PROD001',
          Name: 'Product 1',
          Amount: 30000,
          Quantity: 1,
          UnitPrice: 30000,
        },
        {
          Code: 'PROD002',
          Name: 'Product 2',
          Amount: 20000,
          Quantity: 2,
          UnitPrice: 10000,
        },
      ],
    },
  ],
  LinkUrlSuccess: 'https://yoursite.com/success',
  LinkUrlCancel: 'https://yoursite.com/cancel',
  Lang: 'en-US',
});

// Payment is created, use PaymentID to redirect user
console.log('Payment ID:', payment.PaymentID);
console.log('Signature:', payment.Signature);
```

### Get Payment Status

```typescript
const payment = await sdk.getPayment(12345);
console.log('Status:', payment.Status);
console.log('Processed:', payment.Processed);
```

### Search Payments

```typescript
// Search by invoice
const payments = await sdk.searchPayments({
  Invoice: 12345,
});

// Search by date range
const payments = await sdk.searchPayments({
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-31T23:59:59Z',
});
```

### Build Payment Forms

#### GetEcom Form (Server-to-Server Flow)

After creating a payment via API, redirect user to Paynet portal:

```typescript
const payment = await sdk.createPayment({
  /* ... */
});

const formHtml = sdk.buildGetEcomForm(
  payment,
  'https://yoursite.com/success',
  'https://yoursite.com/cancel',
  'en-US'
);

// Return form HTML to client, or auto-submit
res.send(formHtml);
```

#### SetEcom Form (Client-to-Server Flow)

Build form directly from payment data (no API call needed):

```typescript
const payment = {
  Invoice: 12345,
  MerchantCode: '123456',
  Currency: 498,
  ExpiryDate: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
  ExternalDate: new Date().toISOString(),
  Customer: {
    /* ... */
  },
  Services: [
    /* ... */
  ],
  LinkUrlSuccess: 'https://yoursite.com/success',
  LinkUrlCancel: 'https://yoursite.com/cancel',
};

const formHtml = sdk.buildSetEcomForm(
  payment,
  'https://yoursite.com/success',
  'https://yoursite.com/cancel',
  'en-US'
);
```

### Webhook Verification

```typescript
import { verifyNotificationSignature } from 'paynet-sdk';

app.post('/webhooks/paynet', (req, res) => {
  const notification = req.body;

  // Verify signature
  const isValid = sdk.verifyNotificationSignature(notification);
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Process notification
  if (notification.EventType === 'PAID') {
    console.log('Payment paid:', notification.Payment.ID);
    // Update your database, send confirmation email, etc.
  }

  res.status(200).send('OK');
});
```

### Manual Signature Generation

```typescript
import { generatePaymentSignature } from 'paynet-sdk';

const payment = {
  /* ... */
  Signature: generatePaymentSignature(payment, '550e8400-e29b-41d4-a716-446655440000'),
};
```

## API Reference

### PaynetServerSDK

#### Constructor

```typescript
new PaynetServerSDK(config: PaynetServerSDKConfig)
```

**Config:**

- `apiHost` (string, required): Paynet API host URL
- `portalHost` (string, required): Paynet portal host URL
- `secretKey` (string, required): Shared secret for signature generation
- `httpClient` (object, optional): Custom fetch implementation
- `debug` (boolean, optional): Enable debug logging

#### Methods

- `authenticate(username: string, password: string): Promise<AuthenticateResponse>`
- `setAccessToken(token: string, expiresIn?: number): void`
- `getAccessToken(): string | null`
- `createPayment(payment: Payment): Promise<Payment>`
- `getPayment(paymentId: number): Promise<Payment>`
- `searchPayments(criteria: SearchCriteria): Promise<Payment[]>`
- `verifyNotificationSignature(notification: PaymentNotificationRequest): boolean`
- `generatePaymentSignature(payment: Payment): string`
- `buildGetEcomForm(payment: Payment, successUrl: string, cancelUrl: string, lang?: string): string`
- `buildSetEcomForm(payment: Payment, successUrl: string, cancelUrl: string, lang?: string): string`

## TODO

- [ ] Add retry logic for transient API failures
- [ ] Implement request/response interceptors
- [ ] Add unit/int tests
- [ ] JSDoc public methods

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Type check
pnpm type-check

# Lint
pnpm lint

# Format
pnpm format
```

## License

MIT

## Attribution

This SDK is based on [Paynet API v0.5 specifications](https://info.paynet.md/plugin/cms-api.zip). Refer to [paynet.md](paynet.md) for official API documentation.
