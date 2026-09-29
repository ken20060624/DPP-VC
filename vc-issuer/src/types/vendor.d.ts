declare module '@digitalbazaar/credentials-context' {
  export const contexts: Map<string, unknown>;
}

declare module '@digitalbazaar/data-integrity-context' {
  export const contexts: Map<string, unknown>;
}

declare module '@digitalbazaar/multikey-context' {
  export const contexts: Map<string, unknown>;
}

declare module 'did-context' {
  export const contexts: Map<string, unknown>;
}

declare module '@digitalbazaar/ed25519-multikey' {
  export interface MultikeyDocument {
    '@context'?: string | unknown[];
    id?: string;
    type?: string;
    controller?: string;
    publicKeyMultibase: string;
    secretKeyMultibase?: string;
  }

  export interface MultikeyPair extends MultikeyDocument {
    export(options?: {
      publicKey?: boolean;
      secretKey?: boolean;
      includeContext?: boolean;
      canonicalize?: boolean;
    }): Promise<MultikeyDocument>;
    signer(): {
      algorithm: string;
      id: string;
      sign(options: {data: Uint8Array}): Promise<Uint8Array>;
    };
    verifier(): {
      algorithm: string;
      id: string;
      verify(options: {
        data: Uint8Array;
        signature: Uint8Array;
      }): Promise<boolean>;
    };
  }

  export function generate(options?: {
    id?: string;
    controller?: string;
    seed?: Uint8Array;
  }): Promise<MultikeyPair>;

  export function from(key: MultikeyDocument): Promise<MultikeyPair>;
}

declare module '@digitalbazaar/data-integrity' {
  export class DataIntegrityProof {
    constructor(options: {
      signer?: unknown;
      date?: string | Date | number | null;
      cryptosuite: unknown;
    });
  }
}

declare module '@digitalbazaar/eddsa-jcs-2022-cryptosuite' {
  export function createSignCryptosuite(): unknown;
  export function createVerifyCryptosuite(): unknown;
}

declare module 'jsonld-signatures' {
  interface JsonLdSignatures {
    sign(document: Record<string, unknown>, options: {
      suite: unknown;
      purpose: unknown;
      documentLoader: (url: string) => Promise<unknown>;
    }): Promise<Record<string, unknown>>;
    verify(document: Record<string, unknown>, options: {
      suite: unknown;
      purpose: unknown;
      documentLoader: (url: string) => Promise<unknown>;
    }): Promise<{
      verified: boolean;
      error?: Error;
      results?: Array<{verified: boolean; error?: Error}>;
    }>;
    purposes: {
      AssertionProofPurpose: new (options?: {
        controller?: Record<string, unknown>;
        date?: string | Date | number;
        maxTimestampDelta?: number;
      }) => unknown;
    };
  }

  const jsigs: JsonLdSignatures;
  export default jsigs;
}
