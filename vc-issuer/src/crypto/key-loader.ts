import {readFile} from 'node:fs/promises';
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import type {
  MultikeyDocument,
  MultikeyPair
} from '@digitalbazaar/ed25519-multikey';

export async function loadPrivateKey(filePath: string): Promise<MultikeyPair> {
  const source = await readFile(filePath, 'utf8');
  const document = JSON.parse(source) as MultikeyDocument;
  if(!document.secretKeyMultibase) {
    throw new Error('Issuer key file does not contain a private key.');
  }
  return Ed25519Multikey.from(document);
}

export async function exportPublicKey(
  keyPair: MultikeyPair
): Promise<MultikeyDocument> {
  const publicKey = await keyPair.export({
    publicKey: true,
    secretKey: false,
    includeContext: true
  });
  delete publicKey.secretKeyMultibase;
  return publicKey;
}
