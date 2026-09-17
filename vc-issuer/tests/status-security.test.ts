import {afterEach, describe, expect, it} from 'vitest';
import {DidKeyProvider} from '../src/identity/did-key-provider.js';
import {StatusListService} from '../src/status/status-list-service.js';
import {FileStatusListStore} from '../src/status/status-list-store.js';
import {CredentialBuilder} from '../src/vc/credential-builder.js';
import {CredentialIssuer} from '../src/vc/credential-issuer.js';
import {CredentialVerifier} from '../src/vc/credential-verifier.js';
import {
  createTestWorkspace,
  loadFanFixture,
  type TestWorkspace
} from './helpers.js';

const workspaces: TestWorkspace[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map(item => item.cleanup()));
});

describe('status-list trust boundary', () => {
  it('fails closed when the signed status-list payload is tampered with',
    async () => {
      const workspace = await createTestWorkspace();
      workspaces.push(workspace);
      const identity = await new DidKeyProvider(workspace.keyPath).load();
      const clock = () => new Date('2026-09-17T00:00:00.000Z');
      const builder = new CredentialBuilder(
        clock,
        () => '11111111-2222-4333-8444-555555555555'
      );
      const realStatusList = new StatusListService(
        new FileStatusListStore(workspace.config.statusListStorePath, () => 12),
        identity,
        workspace.config.publicBaseUrl,
        clock
      );
      const id = builder.createCredentialId();
      const entry = await realStatusList.createEntry(id);
      const credential = await new CredentialIssuer(identity, builder, clock)
        .issue(await loadFanFixture(), entry, id);
      const tampered = await realStatusList.createCredential();
      tampered.credentialSubject.encodedList =
        `${tampered.credentialSubject.encodedList}A`;
      const hostileStatusSource = {
        statusListUrl: realStatusList.statusListUrl,
        createCredential: async () => tampered
      } as unknown as StatusListService;

      const verifier = new CredentialVerifier(
        identity,
        hostileStatusSource,
        clock
      );
      expect(await verifier.verify(credential)).toMatchObject({
        verified: false,
        errors: ['STATUS_LIST_VERIFICATION_FAILED'],
        checks: {
          proof: 'passed',
          statusListProof: 'failed',
          credentialStatus: 'failed'
        }
      });
    });
});
