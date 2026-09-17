import {loadPrivateKey, exportPublicKey} from '../crypto/key-loader.js';
import {
  DID_V1_CONTEXT_URL,
  MULTIKEY_CONTEXT_URL
} from '../constants.js';
import type {
  IssuerIdentity,
  IssuerIdentityProvider
} from './issuer-identity-provider.js';

export class DidKeyProvider implements IssuerIdentityProvider {
  constructor(private readonly privateKeyPath: string) {}

  async load(): Promise<IssuerIdentity> {
    const keyPair = await loadPrivateKey(this.privateKeyPath);
    const publicKey = await exportPublicKey(keyPair);
    if(!publicKey.publicKeyMultibase) {
      throw new Error('Issuer public key is missing publicKeyMultibase.');
    }

    const did = `did:key:${publicKey.publicKeyMultibase}`;
    const verificationMethodId = `${did}#${publicKey.publicKeyMultibase}`;

    keyPair.id = verificationMethodId;
    keyPair.controller = did;
    publicKey.id = verificationMethodId;
    publicKey.controller = did;
    publicKey.type = 'Multikey';
    publicKey['@context'] = MULTIKEY_CONTEXT_URL;

    const controllerDocument = {
      '@context': [DID_V1_CONTEXT_URL, MULTIKEY_CONTEXT_URL],
      id: did,
      verificationMethod: [publicKey],
      assertionMethod: [verificationMethodId]
    };

    return {
      did,
      verificationMethodId,
      keyPair,
      publicKey,
      controllerDocument
    };
  }
}
