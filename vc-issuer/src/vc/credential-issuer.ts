import type {IssuerIdentity} from '../identity/issuer-identity-provider.js';
import type {Product} from '../models/product-schema.js';
import {CredentialBuilder, type Clock} from './credential-builder.js';
import type {
  BitstringStatusListEntry,
  ProductCredential
} from './credential-types.js';
import {DataIntegritySigner} from './data-integrity-signer.js';
import {PRODUCT_CONTEXT_URL} from '../constants.js';

export class CredentialIssuer {
  private readonly signer: DataIntegritySigner;

  constructor(
    private readonly identity: IssuerIdentity,
    private readonly builder: CredentialBuilder,
    clock: Clock = () => new Date(),
    productContextUrl: string = PRODUCT_CONTEXT_URL
  ) {
    this.signer = new DataIntegritySigner(identity, clock, productContextUrl);
  }

  async issue(
    product: Product,
    credentialStatus: BitstringStatusListEntry,
    credentialId?: string
  ): Promise<ProductCredential> {
    const unsecuredCredential = await this.builder.build({
      product,
      issuer: this.identity.did,
      credentialStatus,
      ...(credentialId === undefined ? {} : {credentialId})
    });
    return this.signer.sign(unsecuredCredential);
  }
}
