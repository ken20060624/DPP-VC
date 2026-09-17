import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config as loadDotEnv} from 'dotenv';
import {z} from 'zod';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const MODULE_PARENT = path.resolve(MODULE_DIR, '..');
export const PROJECT_ROOT = path.basename(MODULE_PARENT) === 'dist' ?
  path.dirname(MODULE_PARENT) : MODULE_PARENT;

loadDotEnv({path: path.join(PROJECT_ROOT, '.env'), quiet: true});

const booleanString = z.enum(['true', 'false']).default('true')
  .transform(value => value === 'true');

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('127.0.0.1'),
  ISSUER_DID_METHOD: z.enum(['key', 'web']).default('key'),
  ISSUER_DID_WEB: z.string().optional(),
  ISSUER_VERIFICATION_METHOD_FRAGMENT: z.string().min(1).default('key-1'),
  ISSUER_PRIVATE_KEY_PATH: z.string().min(1)
    .default('./secrets/issuer-key.json'),
  OPERATOR_API_KEY_SHA256: z.string().regex(/^[0-9a-f]{64}$/i),
  PUBLIC_BASE_URL: z.url().default('http://127.0.0.1:3000'),
  CREDENTIAL_STORE_ENABLED: booleanString,
  CREDENTIAL_STORE_PATH: z.string().min(1).default('./data/credentials'),
  STATUS_LIST_STORE_PATH: z.string().min(1).default('./data/status'),
  CORS_ORIGINS: z.string().default('http://localhost:5173')
}).superRefine((value, context) => {
  const publicUrl = new URL(value.PUBLIC_BASE_URL);
  if(publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) {
    context.addIssue({
      code: 'custom',
      path: ['PUBLIC_BASE_URL'],
      message: 'PUBLIC_BASE_URL must not include a path, query, or fragment.'
    });
  }
  if(value.ISSUER_DID_METHOD === 'web') {
    const expectedDid = `did:web:${publicUrl.host.replace(':', '%3A')}`;
    if(value.ISSUER_DID_WEB !== expectedDid) {
      context.addIssue({
        code: 'custom',
        path: ['ISSUER_DID_WEB'],
        message: `ISSUER_DID_WEB must equal ${expectedDid}.`
      });
    }
    if(publicUrl.protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['PUBLIC_BASE_URL'],
        message: 'did:web requires an HTTPS public base URL.'
      });
    }
  }
});

export interface AppConfig {
  port: number;
  host: string;
  issuerDidMethod: 'key' | 'web';
  issuerDidWeb?: string;
  issuerVerificationMethodFragment: string;
  issuerPrivateKeyPath: string;
  operatorApiKeySha256: string;
  publicBaseUrl: string;
  productContextUrl: string;
  credentialStoreEnabled: boolean;
  credentialStorePath: string;
  statusListStorePath: string;
  corsOrigins: string[];
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env
): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if(!result.success) {
    throw new Error(`Invalid service configuration: ${result.error.message}`);
  }

  const parsed = result.data;
  return {
    port: parsed.PORT,
    host: parsed.HOST,
    issuerDidMethod: parsed.ISSUER_DID_METHOD,
    ...(parsed.ISSUER_DID_WEB === undefined ? {} : {
      issuerDidWeb: parsed.ISSUER_DID_WEB
    }),
    issuerVerificationMethodFragment:
      parsed.ISSUER_VERIFICATION_METHOD_FRAGMENT,
    issuerPrivateKeyPath: resolveProjectPath(parsed.ISSUER_PRIVATE_KEY_PATH),
    operatorApiKeySha256: parsed.OPERATOR_API_KEY_SHA256.toLowerCase(),
    publicBaseUrl: stripTrailingSlash(parsed.PUBLIC_BASE_URL),
    productContextUrl:
      `${stripTrailingSlash(parsed.PUBLIC_BASE_URL)}/contexts/product-v1.jsonld`,
    credentialStoreEnabled: parsed.CREDENTIAL_STORE_ENABLED,
    credentialStorePath: resolveProjectPath(parsed.CREDENTIAL_STORE_PATH),
    statusListStorePath: resolveProjectPath(parsed.STATUS_LIST_STORE_PATH),
    corsOrigins: [...commaSeparatedSet(parsed.CORS_ORIGINS)]
  };
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function resolveProjectPath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(PROJECT_ROOT, value);
}

function commaSeparatedSet(value: string): Set<string> {
  return new Set(value.split(',').map(item => item.trim()).filter(Boolean));
}
