import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import {describe, expect, it} from 'vitest';
import {
  DID_V1_CONTEXT_URL,
  MULTIKEY_CONTEXT_URL
} from '../src/constants.js';
import type {IssuerIdentity} from
  '../src/identity/issuer-identity-provider.js';
import {StatusListService} from '../src/status/status-list-service.js';
import {FileStatusListStore} from '../src/status/status-list-store.js';
import {CredentialBuilder} from '../src/vc/credential-builder.js';
import {CredentialIssuer} from '../src/vc/credential-issuer.js';
import {CredentialVerifier} from '../src/vc/credential-verifier.js';
import {loadFanFixture} from './helpers.js';

describe('eddsa-jcs-2022 fixed compatibility vector', () => {
  it('produces and verifies the same proof for fixed inputs', async () => {
    const identity = await createFixedIdentity();
    const now = () => new Date('2026-09-17T00:00:00.000Z');
    const builder = new CredentialBuilder(
      now,
      () => '11111111-2222-4333-8444-555555555555'
    );
    const issuer = new CredentialIssuer(identity, builder, now);
    const statusRoot = await mkdtemp(path.join(os.tmpdir(), 'status-vector-'));
    const statusList = new StatusListService(
      new FileStatusListStore(statusRoot, () => 42),
      identity,
      'https://issuer.example',
      now
    );
    const credentialId = builder.createCredentialId();
    const statusEntry = await statusList.createEntry(credentialId);
    const credential = await issuer.issue(
      await loadFanFixture(),
      statusEntry,
      credentialId
    );

    expect(credential.proof?.proofValue).toBe(
      'z4AjCXLuoQsCUGpMnWf7vz2ga6CWA4MkcZuSrdhMyEcx3sMW4gUcbZVtQWfQ1b4Vk2w62phCfbpm7go8xW5yazKmD'
    );

    const roundTripped = JSON.parse(JSON.stringify(credential)) as unknown;
    const verifier = new CredentialVerifier(identity, statusList, now);
    expect(await verifier.verify(roundTripped)).toMatchObject({
      verified: true,
      checks: {proof: 'passed'}
    });
    await rm(statusRoot, {recursive: true, force: true});
  });
});

async function createFixedIdentity(): Promise<IssuerIdentity> {
  const seed = Uint8Array.from({length: 32}, (_value, index) => index);
  const keyPair = await Ed25519Multikey.generate({seed});
  const publicKey = await keyPair.export({
    publicKey: true,
    secretKey: false,
    includeContext: true
  });
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
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
