import {
  STATUS_LIST_PATH,
  VC_V2_CONTEXT_URL
} from '../constants.js';
import type {IssuerIdentity} from '../identity/issuer-identity-provider.js';
import type {Clock} from '../vc/credential-builder.js';
import {DataIntegritySigner} from '../vc/data-integrity-signer.js';
import type {
  BitstringStatusListCredential,
  BitstringStatusListEntry,
  ProductCredential
} from '../vc/credential-types.js';
import {encodeStatusList} from './bitstring.js';
import {
  FileStatusListStore,
  type RevocationResult
} from './status-list-store.js';

export class StatusListService {
  readonly statusListUrl: string;
  private readonly signer: DataIntegritySigner;

  constructor(
    private readonly store: FileStatusListStore,
    private readonly identity: IssuerIdentity,
    publicBaseUrl: string,
    private readonly clock: Clock = () => new Date()
  ) {
    this.statusListUrl = `${publicBaseUrl}${STATUS_LIST_PATH}`;
    this.signer = new DataIntegritySigner(identity, clock);
  }

  async createEntry(credentialId: string): Promise<BitstringStatusListEntry> {
    const index = await this.store.reserve(credentialId);
    return {
      id: `${this.statusListUrl}#${index}`,
      type: 'BitstringStatusListEntry',
      statusPurpose: 'revocation',
      statusListIndex: String(index),
      statusListCredential: this.statusListUrl
    };
  }

  async revoke(credential: ProductCredential): Promise<RevocationResult> {
    const entry = credential.credentialStatus;
    if(!entry || entry.statusListCredential !== this.statusListUrl ||
      entry.statusPurpose !== 'revocation') {
      throw new Error('Credential does not contain the configured status entry.');
    }
    return this.store.revoke(
      credential.id,
      Number.parseInt(entry.statusListIndex, 10)
    );
  }

  async createCredential(): Promise<BitstringStatusListCredential> {
    const encodedList = encodeStatusList(await this.store.revokedIndices());
    const unsecured: BitstringStatusListCredential = {
      '@context': [VC_V2_CONTEXT_URL],
      id: this.statusListUrl,
      type: ['VerifiableCredential', 'BitstringStatusListCredential'],
      issuer: this.identity.did,
      validFrom: this.clock().toISOString(),
      credentialSubject: {
        id: `${this.statusListUrl}#list`,
        type: 'BitstringStatusList',
        statusPurpose: 'revocation',
        encodedList,
        ttl: 60_000
      }
    };
    return this.signer.sign(unsecured);
  }
}
