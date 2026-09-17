import {z} from 'zod';
import {AppError} from '../errors.js';

const documentationSchema = z.object({
  userManual: z.url().optional(),
  repairGuide: z.url().optional()
}).passthrough();

const batterySchema = z.object({
  supplierDid: z.string().startsWith('did:').optional(),
  chemistry: z.string().min(1).max(100),
  capacityMah: z.number().finite().positive(),
  voltageV: z.number().finite().positive(),
  energyWh: z.number().finite().positive(),
  certifications: z.array(z.string().min(1).max(100)).optional(),
  criticalRawMaterials: z.record(z.string(), z.number().finite().nonnegative())
    .optional()
}).passthrough();

const environmentalMetricsSchema = z.object({
  carbonFootprintKgCO2e: z.number().finite().nonnegative(),
  pcrPlasticPercentage: z.number().finite().min(0).max(100),
  recyclabilityPercentage: z.number().finite().min(0).max(100),
  rohsCompliant: z.boolean(),
  reachCompliant: z.boolean()
}).passthrough();

export const productSchema = z.object({
  id: z.url(),
  gtin: z.string().regex(/^\d{14}$/),
  serialNumber: z.string().regex(/^[A-Za-z0-9._-]{1,20}$/),
  productName: z.string().min(1).max(200),
  modelNumber: z.string().min(1).max(100),
  brand: z.string().min(1).max(100),
  countryOfOrigin: z.string().regex(/^[A-Z]{2}$/),
  documentation: documentationSchema.optional(),
  batteryComponent: batterySchema.optional(),
  environmentalMetrics: environmentalMetricsSchema.optional()
}).passthrough();

export type Product = z.infer<typeof productSchema>;

export function hasValidGtinCheckDigit(gtin: string): boolean {
  if(!/^\d{14}$/.test(gtin)) {
    return false;
  }

  const digits = [...gtin].map(Number);
  const checkDigit = digits.at(-1);
  const body = digits.slice(0, -1);
  let sum = 0;
  let weight = 3;

  for(let index = body.length - 1; index >= 0; index -= 1) {
    sum += (body[index] ?? 0) * weight;
    weight = weight === 3 ? 1 : 3;
  }

  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function parseAndValidateProduct(input: unknown): Product {
  const result = productSchema.safeParse(input);
  if(!result.success) {
    throw new AppError({
      code: 'INVALID_PRODUCT',
      message: 'The product payload does not match the required schema.',
      statusCode: 422,
      details: result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
  }

  const product = result.data;
  if(!hasValidGtinCheckDigit(product.gtin)) {
    throw new AppError({
      code: 'INVALID_GTIN_CHECK_DIGIT',
      message: 'The product GTIN-14 check digit is invalid.',
      statusCode: 422
    });
  }

  validateProductIdentity(product);
  return product;
}

function validateProductIdentity(product: Product): void {
  let url: URL;
  try {
    url = new URL(product.id);
  } catch {
    throw productIdMismatch();
  }

  if(url.protocol !== 'https:') {
    throw productIdMismatch();
  }

  const match = /^\/01\/(\d{14})\/21\/([A-Za-z0-9._-]{1,20})$/.exec(
    url.pathname
  );
  if(!match || match[1] !== product.gtin ||
    match[2] !== product.serialNumber || url.search || url.hash) {
    throw productIdMismatch();
  }
}

function productIdMismatch(): AppError {
  return new AppError({
    code: 'PRODUCT_ID_MISMATCH',
    message: 'Product id, GTIN, and serial number are not consistent.',
    statusCode: 422
  });
}
