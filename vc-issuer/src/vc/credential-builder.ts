import {randomUUID} from 'node:crypto';
import {
  PRODUCT_CONTEXT_URL,
  VC_V2_CONTEXT_URL
} from '../constants.js';
import type {Product} from '../models/product-schema.js';
import type {ProductCredential} from './credential-types.js';
import type {BitstringStatusListEntry} from './credential-types.js';

export type Clock = () => Date;
export type IdGenerator = () => string;

export class CredentialBuilder {
  constructor(
    private readonly clock: Clock = () => new Date(),
    private readonly idGenerator: IdGenerator = randomUUID,
    private readonly productContextUrl: string = PRODUCT_CONTEXT_URL
  ) {}

  async build(options: {
    product: Product;
    issuer: string;
    credentialStatus: BitstringStatusListEntry;
    credentialId?: string;
  }): Promise<ProductCredential> {
    return {
      '@context': [VC_V2_CONTEXT_URL, this.productContextUrl],
      id: options.credentialId ?? this.createCredentialId(),
      type: ['VerifiableCredential', 'ProductCredential'],
      issuer: options.issuer,
      validFrom: this.clock().toISOString(),
      credentialStatus: structuredClone(options.credentialStatus),
      credentialSubject: structuredClone(options.product)
    };
  }

  createCredentialId(): string {
    return `urn:uuid:${this.idGenerator()}`;
  }
}
