import {DataIntegrityProof} from '@digitalbazaar/data-integrity';
import {createSignCryptosuite} from
  '@digitalbazaar/eddsa-jcs-2022-cryptosuite';
import jsigs from 'jsonld-signatures';
import type {IssuerIdentity} from '../identity/issuer-identity-provider.js';
import type {Clock} from './credential-builder.js';
import {PRODUCT_CONTEXT_URL} from '../constants.js';
import {createDocumentLoader} from './document-loader.js';

const {AssertionProofPurpose} = jsigs.purposes;

export class DataIntegritySigner {
  private readonly documentLoader: ReturnType<typeof createDocumentLoader>;

  constructor(
    private readonly identity: IssuerIdentity,
    private readonly clock: Clock = () => new Date(),
    productContextUrl: string = PRODUCT_CONTEXT_URL
  ) {
    this.documentLoader = createDocumentLoader(identity, productContextUrl);
  }

  async sign<T extends Record<string, unknown>>(document: T): Promise<T> {
    const suite = new DataIntegrityProof({
      signer: this.identity.keyPair.signer(),
      date: this.clock(),
      cryptosuite: createSignCryptosuite()
    });
    return await jsigs.sign(document, {
      suite,
      purpose: new AssertionProofPurpose(),
      documentLoader: this.documentLoader
    }) as T;
  }
}
