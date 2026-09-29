import {loadPrivateKey, exportPublicKey} from '../crypto/key-loader.js';
import {
  DID_V1_CONTEXT_URL,
  MULTIKEY_CONTEXT_URL
} from '../constants.js';
import type {
  IssuerIdentity,
  IssuerIdentityProvider
} from './issuer-identity-provider.js';

const DID_WEB_PATTERN = /^did:web:[a-z0-9.-]+(?:%3A[0-9]+)?$/;
const FRAGMENT_PATTERN = /^[A-Za-z0-9._~-]+$/;

export class DidWebProvider implements IssuerIdentityProvider {
  constructor(
    private readonly privateKeyPath: string,
    private readonly did: string,
    private readonly verificationMethodFragment: string
  ) {}

  async load(): Promise<IssuerIdentity> {
    if(!DID_WEB_PATTERN.test(this.did)) {
      throw new Error('Only root-domain did:web identifiers are supported.');
    }
    if(!FRAGMENT_PATTERN.test(this.verificationMethodFragment)) {
      throw new Error('Invalid did:web verification method fragment.');
    }

    const keyPair = await loadPrivateKey(this.privateKeyPath);
    const publicKey = await exportPublicKey(keyPair);
    if(!publicKey.publicKeyMultibase) {
      throw new Error('Issuer public key is missing publicKeyMultibase.');
    }

    const verificationMethodId =
      `${this.did}#${this.verificationMethodFragment}`;
    keyPair.id = verificationMethodId;
    keyPair.controller = this.did;
    publicKey.id = verificationMethodId;
    publicKey.controller = this.did;
    publicKey.type = 'Multikey';
    publicKey['@context'] = MULTIKEY_CONTEXT_URL;

    const controllerDocument = {
      '@context': [DID_V1_CONTEXT_URL, MULTIKEY_CONTEXT_URL],
      id: this.did,
      verificationMethod: [publicKey],
      assertionMethod: [verificationMethodId]
    };

    return {
      did: this.did,
      verificationMethodId,
      keyPair,
      publicKey,
      controllerDocument
    };
  }
}
