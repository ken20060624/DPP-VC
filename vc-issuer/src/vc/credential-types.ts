import type {Product} from '../models/product-schema.js';

export interface DataIntegrityProofDocument extends Record<string, unknown> {
  type: 'DataIntegrityProof';
  cryptosuite: 'eddsa-jcs-2022';
  created: string;
  verificationMethod: string;
  proofPurpose: 'assertionMethod';
  proofValue: string;
}

export interface ProductCredential extends Record<string, unknown> {
  '@context': unknown[];
  id: string;
  type: ['VerifiableCredential', 'ProductCredential'];
  issuer: string;
  validFrom: string;
  credentialStatus: BitstringStatusListEntry;
  credentialSubject: Product;
  proof?: DataIntegrityProofDocument;
}

export interface BitstringStatusListEntry extends Record<string, unknown> {
  id: string;
  type: 'BitstringStatusListEntry';
  statusPurpose: 'revocation';
  statusListIndex: string;
  statusListCredential: string;
}

export interface BitstringStatusListCredential extends
  Record<string, unknown> {
  '@context': [string];
  id: string;
  type: ['VerifiableCredential', 'BitstringStatusListCredential'];
  issuer: string;
  validFrom: string;
  credentialSubject: {
    id: string;
    type: 'BitstringStatusList';
    statusPurpose: 'revocation';
    encodedList: string;
    ttl?: number;
  };
  proof?: DataIntegrityProofDocument;
}

export interface VerificationResult {
  verified: boolean;
  issuerTrusted: boolean;
  credentialId?: string;
  subjectId?: string;
  checks: {
    proof: 'passed' | 'failed' | 'not-run';
    proofPurpose: 'passed' | 'failed' | 'not-run';
    issuerBinding: 'passed' | 'failed' | 'not-run';
    time: 'passed' | 'failed' | 'not-run';
    statusListProof: 'passed' | 'failed' | 'not-run';
    credentialStatus: 'passed' | 'failed' | 'not-run';
  };
  errors?: string[];
  warnings: string[];
}
