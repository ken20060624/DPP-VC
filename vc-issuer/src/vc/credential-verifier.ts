import {isDeepStrictEqual} from 'node:util';
import {DataIntegrityProof} from '@digitalbazaar/data-integrity';
import {createVerifyCryptosuite} from
  '@digitalbazaar/eddsa-jcs-2022-cryptosuite';
import jsigs from 'jsonld-signatures';
import {z} from 'zod';
import {
  CRYPTOSUITE,
  PRODUCT_CONTEXT_URL,
  PROOF_PURPOSE,
  PROOF_TYPE,
  STATUS_LIST_ENTRY_COUNT,
  VC_V2_CONTEXT_URL
} from '../constants.js';
import type {IssuerIdentity} from '../identity/issuer-identity-provider.js';
import {parseAndValidateProduct} from '../models/product-schema.js';
import {decodeStatusList, readStatusBit} from '../status/bitstring.js';
import type {StatusListService} from '../status/status-list-service.js';
import type {
  BitstringStatusListCredential,
  ProductCredential,
  VerificationResult
} from './credential-types.js';
import {createDocumentLoader} from './document-loader.js';

const {AssertionProofPurpose} = jsigs.purposes;

const proofSchema = z.object({
  type: z.string(),
  cryptosuite: z.string(),
  created: z.iso.datetime({offset: true}),
  verificationMethod: z.string(),
  proofPurpose: z.string(),
  proofValue: z.string().startsWith('z')
}).passthrough();

const statusEntrySchema = z.object({
  id: z.url(),
  type: z.literal('BitstringStatusListEntry'),
  statusPurpose: z.literal('revocation'),
  statusListIndex: z.string().regex(/^(0|[1-9][0-9]*)$/),
  statusListCredential: z.url()
}).passthrough();

const envelopeSchema = z.object({
  '@context': z.array(z.unknown()).min(2),
  id: z.string().regex(/^urn:uuid:[0-9a-f-]{36}$/i),
  type: z.array(z.string()),
  issuer: z.string().startsWith('did:'),
  validFrom: z.iso.datetime({offset: true}),
  credentialStatus: statusEntrySchema,
  credentialSubject: z.unknown(),
  proof: proofSchema
}).passthrough();

const statusListCredentialSchema = z.object({
  '@context': z.array(z.unknown()),
  id: z.url(),
  type: z.array(z.string()),
  issuer: z.string().startsWith('did:'),
  validFrom: z.iso.datetime({offset: true}),
  credentialSubject: z.object({
    id: z.url(),
    type: z.literal('BitstringStatusList'),
    statusPurpose: z.literal('revocation'),
    encodedList: z.string().startsWith('u'),
    ttl: z.number().int().positive().optional()
  }).passthrough(),
  proof: proofSchema
}).passthrough();

export class CredentialVerifier {
  private readonly documentLoader: ReturnType<typeof createDocumentLoader>;
  private readonly trustedIssuers: Set<string>;

  constructor(
    private readonly identity: IssuerIdentity,
    private readonly statusListService: StatusListService,
    private readonly clock: () => Date = () => new Date(),
    private readonly productContextUrl: string = PRODUCT_CONTEXT_URL
  ) {
    this.documentLoader = createDocumentLoader(identity, productContextUrl);
    this.trustedIssuers = new Set([identity.did]);
  }

  async verify(input: unknown): Promise<VerificationResult> {
    const base = emptyResult();
    const parsed = envelopeSchema.safeParse(input);
    if(!parsed.success) {
      return failure(base, 'INVALID_CREDENTIAL_FORMAT');
    }

    const credential = parsed.data as ProductCredential;
    if(!isDeepStrictEqual(credential['@context'], [
      VC_V2_CONTEXT_URL,
      this.productContextUrl
    ]) || !isDeepStrictEqual(credential.type,
      ['VerifiableCredential', 'ProductCredential'])) {
      return failure(base, 'UNSUPPORTED_CREDENTIAL');
    }

    try {
      parseAndValidateProduct(credential.credentialSubject);
    } catch {
      return failure(base, 'INVALID_CREDENTIAL_SUBJECT');
    }

    if(!this.trustedIssuers.has(credential.issuer)) {
      return failure(base, 'UNTRUSTED_ISSUER');
    }
    base.issuerTrusted = true;

    const proofError = this.validateProofEnvelope(credential);
    if(proofError) {
      applyProofFailure(base, proofError);
      return failure(base, proofError);
    }
    base.checks.proofPurpose = 'passed';
    base.checks.issuerBinding = 'passed';

    if(this.isFuture(credential.validFrom) ||
      this.isFuture(credential.proof!.created)) {
      base.checks.time = 'failed';
      return failure(base, 'CREDENTIAL_NOT_YET_VALID');
    }
    base.checks.time = 'passed';

    if(!await this.verifyDataIntegrity(credential)) {
      base.checks.proof = 'failed';
      return failure(base, 'INVALID_SIGNATURE');
    }
    base.checks.proof = 'passed';

    const statusResult = await this.verifyCredentialStatus(credential);
    base.checks.statusListProof = statusResult.statusListProof;
    base.checks.credentialStatus = statusResult.credentialStatus;
    if(statusResult.error) {
      return failure(base, statusResult.error);
    }

    base.verified = true;
    base.credentialId = credential.id;
    base.subjectId = credential.credentialSubject.id;
    return base;
  }

  private validateProofEnvelope(
    document: ProductCredential | BitstringStatusListCredential
  ): string | undefined {
    const proof = document.proof;
    if(!proof || proof.type !== PROOF_TYPE ||
      proof.cryptosuite !== CRYPTOSUITE) {
      return 'UNSUPPORTED_CRYPTOSUITE';
    }
    if(!isDeepStrictEqual(proof['@context'], document['@context'])) {
      return 'INVALID_PROOF_CONTEXT';
    }
    if(proof.proofPurpose !== PROOF_PURPOSE) {
      return 'INVALID_PROOF_PURPOSE';
    }
    if(proof.verificationMethod !== this.identity.verificationMethodId ||
      document.issuer !== this.identity.did ||
      !isAssertionMethodAuthorized(this.identity, proof.verificationMethod)) {
      return 'ISSUER_KEY_BINDING_FAILED';
    }
    return undefined;
  }

  private async verifyCredentialStatus(credential: ProductCredential):
    Promise<{
      statusListProof: 'passed' | 'failed';
      credentialStatus: 'passed' | 'failed';
      error?: string;
    }> {
    const entry = credential.credentialStatus;
    const index = Number.parseInt(entry.statusListIndex, 10);
    if(entry.statusListCredential !== this.statusListService.statusListUrl ||
      entry.id !== `${entry.statusListCredential}#${entry.statusListIndex}` ||
      !Number.isSafeInteger(index) || index < 0 ||
      index >= STATUS_LIST_ENTRY_COUNT) {
      return statusFailure('INVALID_STATUS_ENTRY');
    }

    try {
      const statusList = await this.statusListService.createCredential();
      const parsed = statusListCredentialSchema.safeParse(statusList);
      if(!parsed.success) {
        return statusFailure('STATUS_LIST_VERIFICATION_FAILED');
      }
      const checked = parsed.data as BitstringStatusListCredential;
      if(!isDeepStrictEqual(checked['@context'], [VC_V2_CONTEXT_URL]) ||
        !isDeepStrictEqual(checked.type,
          ['VerifiableCredential', 'BitstringStatusListCredential']) ||
        checked.id !== this.statusListService.statusListUrl ||
        checked.credentialSubject.id !==
          `${this.statusListService.statusListUrl}#list` ||
        checked.issuer !== credential.issuer ||
        this.isFuture(checked.validFrom) ||
        this.isFuture(checked.proof!.created) ||
        this.validateProofEnvelope(checked) !== undefined ||
        !await this.verifyDataIntegrity(checked)) {
        return statusFailure('STATUS_LIST_VERIFICATION_FAILED');
      }

      const bitstring = decodeStatusList(
        checked.credentialSubject.encodedList
      );
      if(readStatusBit(bitstring, index)) {
        return {
          statusListProof: 'passed',
          credentialStatus: 'failed',
          error: 'CREDENTIAL_REVOKED'
        };
      }
      return {
        statusListProof: 'passed',
        credentialStatus: 'passed'
      };
    } catch {
      return statusFailure('STATUS_CHECK_FAILED');
    }
  }

  private async verifyDataIntegrity(
    document: ProductCredential | BitstringStatusListCredential
  ): Promise<boolean> {
    const suite = new DataIntegrityProof({
      cryptosuite: createVerifyCryptosuite()
    });
    const verification = await jsigs.verify(document, {
      suite,
      purpose: new AssertionProofPurpose(),
      documentLoader: this.documentLoader
    });
    return verification.verified;
  }

  private isFuture(value: string): boolean {
    return new Date(value).getTime() > this.clock().getTime();
  }
}

function emptyResult(): VerificationResult {
  return {
    verified: false,
    issuerTrusted: false,
    checks: {
      proof: 'not-run',
      proofPurpose: 'not-run',
      issuerBinding: 'not-run',
      time: 'not-run',
      statusListProof: 'not-run',
      credentialStatus: 'not-run'
    },
    warnings: [
      'Product claims were not independently audited.'
    ]
  };
}

function failure(
  result: VerificationResult,
  code: string
): VerificationResult {
  result.errors = [code];
  return result;
}

function statusFailure(error: string): {
  statusListProof: 'failed';
  credentialStatus: 'failed';
  error: string;
} {
  return {
    statusListProof: 'failed',
    credentialStatus: 'failed',
    error
  };
}

function applyProofFailure(result: VerificationResult, code: string): void {
  if(code === 'INVALID_PROOF_PURPOSE') {
    result.checks.proofPurpose = 'failed';
  }
  if(code === 'ISSUER_KEY_BINDING_FAILED') {
    result.checks.issuerBinding = 'failed';
  }
}

function isAssertionMethodAuthorized(
  identity: IssuerIdentity,
  verificationMethodId: string
): boolean {
  const assertionMethods = identity.controllerDocument.assertionMethod;
  return Array.isArray(assertionMethods) && assertionMethods.some(method =>
    method === verificationMethodId ||
    (typeof method === 'object' && method !== null &&
      'id' in method && method.id === verificationMethodId)
  );
}
