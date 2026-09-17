import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import type {AppConfig} from '../src/config.js';
import type {Product} from '../src/models/product-schema.js';

export interface TestWorkspace {
  root: string;
  keyPath: string;
  storePath: string;
  config: AppConfig;
  cleanup(): Promise<void>;
}

export const TEST_OPERATOR_API_KEY = 'test-operator-api-key';
export const TEST_AUTHORIZATION = `Bearer ${TEST_OPERATOR_API_KEY}`;

export async function createTestWorkspace(): Promise<TestWorkspace> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dpp-vc-issuer-'));
  const keyPath = path.join(root, 'issuer-key.json');
  const storePath = path.join(root, 'credentials');
  const statusListStorePath = path.join(root, 'status');
  await generateKey(keyPath);

  return {
    root,
    keyPath,
    storePath,
    config: {
      port: 3000,
      host: '127.0.0.1',
      issuerDidMethod: 'key',
      issuerVerificationMethodFragment: 'key-1',
      issuerPrivateKeyPath: keyPath,
      operatorApiKeySha256: createHash('sha256')
        .update(TEST_OPERATOR_API_KEY)
        .digest('hex'),
      publicBaseUrl: 'http://127.0.0.1:3000',
      productContextUrl:
        'http://127.0.0.1:3000/contexts/product-v1.jsonld',
      credentialStoreEnabled: true,
      credentialStorePath: storePath,
      statusListStorePath,
      corsOrigins: ['http://localhost:5173']
    },
    cleanup: () => rm(root, {recursive: true, force: true})
  };
}

export async function loadFanFixture(): Promise<Product> {
  const fixturePath = path.resolve(
    process.cwd(), '..', 'fixtures', 'products', 'fan-001.json'
  );
  return JSON.parse(await readFile(fixturePath, 'utf8')) as Product;
}

async function generateKey(filePath: string): Promise<void> {
  const keyPair = await Ed25519Multikey.generate();
  const document = await keyPair.export({
    publicKey: true,
    secretKey: true,
    includeContext: true
  });
  document.controller = `did:key:${document.publicKeyMultibase}`;
  document.id = `${document.controller}#${document.publicKeyMultibase}`;
  await writeFile(filePath, JSON.stringify(document), 'utf8');
}
