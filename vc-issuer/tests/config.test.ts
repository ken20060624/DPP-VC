import {createHash} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {loadConfig} from '../src/config.js';

const digest = createHash('sha256').update('test-key').digest('hex');

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    OPERATOR_API_KEY_SHA256: digest,
    ...overrides
  };
}

describe('phase-2 configuration', () => {
  it('loads secure did:key defaults when an operator digest is present', () => {
    expect(loadConfig(environment())).toMatchObject({
      issuerDidMethod: 'key',
      publicBaseUrl: 'http://127.0.0.1:3000',
      operatorApiKeySha256: digest
    });
  });

  it('requires did:web to exactly match an HTTPS public base URL', () => {
    expect(() => loadConfig(environment({
      ISSUER_DID_METHOD: 'web',
      ISSUER_DID_WEB: 'did:web:wrong.example',
      PUBLIC_BASE_URL: 'https://issuer.example'
    }))).toThrow(/ISSUER_DID_WEB/);

    expect(() => loadConfig(environment({
      ISSUER_DID_METHOD: 'web',
      ISSUER_DID_WEB: 'did:web:issuer.example',
      PUBLIC_BASE_URL: 'http://issuer.example'
    }))).toThrow(/HTTPS/);

    expect(loadConfig(environment({
      ISSUER_DID_METHOD: 'web',
      ISSUER_DID_WEB: 'did:web:issuer.example',
      PUBLIC_BASE_URL: 'https://issuer.example/'
    }))).toMatchObject({
      issuerDidMethod: 'web',
      issuerDidWeb: 'did:web:issuer.example',
      publicBaseUrl: 'https://issuer.example'
    });
  });

  it('rejects missing or malformed operator API key digests', () => {
    expect(() => loadConfig({})).toThrow(/OPERATOR_API_KEY_SHA256/);
    expect(() => loadConfig({OPERATOR_API_KEY_SHA256: 'plaintext'}))
      .toThrow(/OPERATOR_API_KEY_SHA256/);
  });
});
