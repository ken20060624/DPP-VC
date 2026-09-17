import type {FastifyInstance} from 'fastify';
import {afterEach, describe, expect, it} from 'vitest';
import {buildApplication} from '../src/application.js';
import {FileCredentialStore} from '../src/storage/credential-store.js';
import {decodeStatusList, readStatusBit} from '../src/status/bitstring.js';
import type {ProductCredential} from '../src/vc/credential-types.js';
import {
  createTestWorkspace,
  loadFanFixture,
  TEST_AUTHORIZATION,
  type TestWorkspace
} from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];
const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.close()));
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

describe('VC issuer HTTP flow', () => {
  it('issues, verifies, stores, and retrieves a VC 2.0 credential', async () => {
    const {workspace, app} = await setup();
    const product = await loadFanFixture();

    const issueResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/credentials/issue',
      headers: {authorization: TEST_AUTHORIZATION},
      payload: {product}
    });
    expect(issueResponse.statusCode).toBe(201);
    const {credential} = issueResponse.json() as {
      credential: ProductCredential;
    };
    expect(credential['@context'][0]).toBe(
      'https://www.w3.org/ns/credentials/v2'
    );
    expect(credential.type).toEqual([
      'VerifiableCredential',
      'ProductCredential'
    ]);
    expect(credential.credentialSubject.id).toBe(product.id);
    expect(credential.proof).toMatchObject({
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      proofPurpose: 'assertionMethod'
    });
    expect(credential.proof?.proofValue).toMatch(/^z/);
    expect(credential.credentialStatus).toMatchObject({
      type: 'BitstringStatusListEntry',
      statusPurpose: 'revocation',
      statusListCredential: 'http://127.0.0.1:3000/status/v1/revocation'
    });

    const verifyResponse = await verify(app, credential);
    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toMatchObject({
      verified: true,
      issuerTrusted: true,
      credentialId: credential.id,
      subjectId: product.id,
      checks: {
        proof: 'passed',
        proofPurpose: 'passed',
        issuerBinding: 'passed',
        time: 'passed',
        statusListProof: 'passed',
        credentialStatus: 'passed'
      }
    });

    const id = credential.id.slice('urn:uuid:'.length);
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/credentials/${id}`
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual({credential});
    expect(workspace.storePath).toBeTruthy();
  });

  it.each([
    ['product name', (credential: ProductCredential) => {
      credential.credentialSubject.productName = 'Tampered fan';
    }],
    ['battery capacity', (credential: ProductCredential) => {
      if(!credential.credentialSubject.batteryComponent) {
        throw new Error('Fixture is missing batteryComponent.');
      }
      credential.credentialSubject.batteryComponent.capacityMah = 9999;
    }],
    ['subject id', (credential: ProductCredential) => {
      credential.credentialSubject.id =
        'https://dpp-demo.example.com/01/00047199990002/21/FAN-2026-002';
      credential.credentialSubject.serialNumber = 'FAN-2026-002';
    }],
    ['status index', (credential: ProductCredential) => {
      credential.credentialStatus.statusListIndex = '0';
      credential.credentialStatus.id =
        `${credential.credentialStatus.statusListCredential}#0`;
    }]
  ])('rejects a signed credential after tampering with %s', async (
    _name,
    mutate
  ) => {
    const {app} = await setup();
    const credential = await issue(app);
    const tampered = structuredClone(credential);
    mutate(tampered);

    const response = await verify(app, tampered);
    expect(response.json()).toMatchObject({
      verified: false,
      errors: ['INVALID_SIGNATURE']
    });
  });

  it('rejects a credential signed by an untrusted issuer', async () => {
    const trusted = await setup();
    const attacker = await setup();
    const attackerCredential = await issue(attacker.app);

    const response = await verify(trusted.app, attackerCredential);
    expect(response.json()).toMatchObject({
      verified: false,
      issuerTrusted: false,
      errors: ['UNTRUSTED_ISSUER']
    });
  });

  it('requires the same bearer-token failure for missing and wrong keys',
    async () => {
      const {app} = await setup();
      const product = await loadFanFixture();
      const missing = await app.inject({
        method: 'POST',
        url: '/api/v1/credentials/issue',
        payload: {product}
      });
      const wrong = await app.inject({
        method: 'POST',
        url: '/api/v1/credentials/issue',
        headers: {authorization: 'Bearer definitely-wrong'},
        payload: {product}
      });

      expect(missing.statusCode).toBe(401);
      expect(wrong.statusCode).toBe(401);
      expect(missing.json()).toEqual(wrong.json());
      expect(missing.headers['www-authenticate']).toBe(
        'Bearer realm="vc-issuer"'
      );
      expect(missing.json()).toMatchObject({
        error: {code: 'AUTHENTICATION_REQUIRED'}
      });
    });

  it('publishes a signed status list and irreversibly revokes a credential',
    async () => {
      const {app} = await setup();
      const credential = await issue(app);
      const id = credential.id.slice('urn:uuid:'.length);
      const index = Number.parseInt(
        credential.credentialStatus.statusListIndex,
        10
      );

      const before = await app.inject({
        method: 'GET',
        url: '/status/v1/revocation'
      });
      expect(before.statusCode).toBe(200);
      const beforeCredential = before.json() as {
        type: string[];
        credentialSubject: {encodedList: string};
        proof: {cryptosuite: string};
      };
      expect(beforeCredential.type).toContain('BitstringStatusListCredential');
      expect(beforeCredential.proof.cryptosuite).toBe('eddsa-jcs-2022');
      const beforeBits = decodeStatusList(
        beforeCredential.credentialSubject.encodedList
      );
      expect(beforeBits.length).toBe(16_384);
      expect(readStatusBit(beforeBits, index)).toBe(false);

      const unauthorized = await app.inject({
        method: 'POST',
        url: `/api/v1/credentials/${id}/revoke`
      });
      expect(unauthorized.statusCode).toBe(401);

      const first = await app.inject({
        method: 'POST',
        url: `/api/v1/credentials/${id}/revoke`,
        headers: {authorization: TEST_AUTHORIZATION}
      });
      const second = await app.inject({
        method: 'POST',
        url: `/api/v1/credentials/${id}/revoke`,
        headers: {authorization: TEST_AUTHORIZATION}
      });
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({
        status: 'revoked',
        alreadyRevoked: false
      });
      expect(second.json()).toMatchObject({
        status: 'revoked',
        alreadyRevoked: true
      });

      const afterVerification = await verify(app, credential);
      expect(afterVerification.json()).toMatchObject({
        verified: false,
        errors: ['CREDENTIAL_REVOKED'],
        checks: {
          proof: 'passed',
          statusListProof: 'passed',
          credentialStatus: 'failed'
        }
      });
      const after = await app.inject({
        method: 'GET',
        url: '/status/v1/revocation'
      });
      const afterBits = decodeStatusList(
        (after.json() as {credentialSubject: {encodedList: string}})
          .credentialSubject.encodedList
      );
      expect(readStatusBit(afterBits, index)).toBe(true);
    });

  it('publishes the product context without requiring authentication',
    async () => {
      const {app} = await setup();
      const response = await app.inject({
        method: 'GET',
        url: '/contexts/product-v1.jsonld'
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/ld+json');
      expect(response.json()).toHaveProperty('@context');
      expect((await app.inject({
        method: 'GET',
        url: '/.well-known/did.json'
      })).statusCode).toBe(404);
    });

  it('publishes a secret-free did:web document in web mode', async () => {
    const workspace = await createTestWorkspace();
    cleanups.push(workspace.cleanup);
    const app = await buildApplication({
      config: {
        ...workspace.config,
        issuerDidMethod: 'web',
        issuerDidWeb: 'did:web:issuer.example',
        publicBaseUrl: 'https://issuer.example',
        productContextUrl:
          'https://issuer.example/contexts/product-v1.jsonld'
      },
      loggerEnabled: false
    });
    apps.push(app);

    const didResponse = await app.inject({
      method: 'GET',
      url: '/.well-known/did.json'
    });
    expect(didResponse.statusCode).toBe(200);
    const document = didResponse.json() as Record<string, unknown>;
    expect(document.id).toBe('did:web:issuer.example');
    expect(JSON.stringify(document)).not.toContain('secretKeyMultibase');
    expect(document.assertionMethod).toEqual([
      'did:web:issuer.example#key-1'
    ]);

    const credential = await issue(app);
    expect(credential.issuer).toBe('did:web:issuer.example');
    expect((await verify(app, credential)).json()).toMatchObject({
      verified: true,
      checks: {credentialStatus: 'passed'}
    });
  });

  it('rejects unknown contexts before cryptographic verification', async () => {
    const {app} = await setup();
    const credential = await issue(app);
    const changed = structuredClone(credential);
    changed['@context'].push('https://attacker.example/context');

    const response = await verify(app, changed);
    expect(response.json()).toMatchObject({
      verified: false,
      errors: ['UNSUPPORTED_CREDENTIAL']
    });
  });

  it('refuses to overwrite a stored credential with the same UUID',
    async () => {
      const {workspace, app} = await setup();
      const credential = await issue(app);
      const store = new FileCredentialStore(workspace.storePath);
      await expect(store.save(credential)).rejects.toMatchObject({
        code: 'EEXIST'
      });
    });

  it('rejects a future validFrom even when the signature is valid', async () => {
    const workspace = await createTestWorkspace();
    cleanups.push(workspace.cleanup);
    const futureApp = await buildApplication({
      config: workspace.config,
      clock: () => new Date('2030-01-01T00:00:00.000Z'),
      loggerEnabled: false
    });
    const presentApp = await buildApplication({
      config: workspace.config,
      clock: () => new Date('2026-09-17T00:00:00.000Z'),
      loggerEnabled: false
    });
    apps.push(futureApp, presentApp);
    const credential = await issue(futureApp);

    const response = await verify(presentApp, credential);
    expect(response.json()).toMatchObject({
      verified: false,
      errors: ['CREDENTIAL_NOT_YET_VALID'],
      checks: {time: 'failed'}
    });
  });

  it('keeps health alive while readiness and issuance fail without a key',
    async () => {
      const workspace = await createTestWorkspace();
      cleanups.push(workspace.cleanup);
      const app = await buildApplication({
        config: {
          ...workspace.config,
          issuerPrivateKeyPath: `${workspace.keyPath}.missing`
        },
        loggerEnabled: false
      });
      apps.push(app);

      expect((await app.inject({method: 'GET', url: '/health'})).statusCode)
        .toBe(200);
      expect((await app.inject({method: 'GET', url: '/ready'})).statusCode)
        .toBe(503);
      expect((await app.inject({
      method: 'POST',
      url: '/api/v1/credentials/issue',
      headers: {authorization: TEST_AUTHORIZATION},
      payload: {product: await loadFanFixture()}
      })).statusCode).toBe(503);
    });

  it('does not allow credential id path traversal', async () => {
    const {app} = await setup();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/credentials/not-a-uuid'
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {code: 'INVALID_CREDENTIAL_ID'}
    });
  });

  it('returns a safe 400 response for malformed JSON', async () => {
    const {app} = await setup();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/credentials/verify',
      headers: {'content-type': 'application/json'},
      payload: '{not-json'
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'The request could not be parsed or accepted.'
      }
    });
  });

  it('rejects browser origins outside the configured allowlist', async () => {
    const {app} = await setup();
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/credentials/verify',
      headers: {
        origin: 'https://attacker.example',
        'access-control-request-method': 'POST'
      }
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: {code: 'ORIGIN_NOT_ALLOWED'}
    });
  });
});

async function setup(): Promise<{
  workspace: TestWorkspace;
  app: FastifyInstance;
}> {
  const workspace = await createTestWorkspace();
  cleanups.push(workspace.cleanup);
  const app = await buildApplication({
    config: workspace.config,
    loggerEnabled: false
  });
  apps.push(app);
  return {workspace, app};
}

async function issue(app: FastifyInstance): Promise<ProductCredential> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/credentials/issue',
    headers: {authorization: TEST_AUTHORIZATION},
    payload: {product: await loadFanFixture()}
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as {credential: ProductCredential}).credential;
}

function verify(app: FastifyInstance, credential: ProductCredential) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/credentials/verify',
    payload: {credential}
  });
}
