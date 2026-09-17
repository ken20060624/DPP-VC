import type {
  MultikeyDocument,
  MultikeyPair
} from '@digitalbazaar/ed25519-multikey';

export interface IssuerIdentity {
  did: string;
  verificationMethodId: string;
  keyPair: MultikeyPair;
  publicKey: MultikeyDocument;
  controllerDocument: Record<string, unknown>;
}

export interface IssuerIdentityProvider {
  load(): Promise<IssuerIdentity>;
}
