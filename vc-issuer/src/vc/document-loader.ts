import {contexts as credentialsContexts} from
  '@digitalbazaar/credentials-context';
import {contexts as dataIntegrityContexts} from
  '@digitalbazaar/data-integrity-context';
import {contexts as multikeyContexts} from '@digitalbazaar/multikey-context';
import {contexts as didContexts} from 'did-context';
import {PRODUCT_CONTEXT_URL} from '../constants.js';
import {PROJECT_ROOT} from '../config.js';
import type {IssuerIdentity} from '../identity/issuer-identity-provider.js';

interface RemoteDocument {
  contextUrl: null;
  documentUrl: string;
  document: unknown;
}

export function createDocumentLoader(
  identity: IssuerIdentity,
  productContextUrl: string = PRODUCT_CONTEXT_URL
) {
  const documents = new Map<string, unknown>();
  addContexts(documents, credentialsContexts);
  addContexts(documents, dataIntegrityContexts);
  addContexts(documents, multikeyContexts);
  addContexts(documents, didContexts);
  documents.set(identity.did, identity.controllerDocument);
  documents.set(identity.verificationMethodId, identity.publicKey);
  let productContext: unknown;

  return async (url: string): Promise<RemoteDocument> => {
    if(url === productContextUrl && productContext === undefined) {
      const contextPath = path.join(
        PROJECT_ROOT, 'contexts', 'product-v1.jsonld'
      );
      productContext = JSON.parse(await readFile(contextPath, 'utf8'));
    }
    if(url === productContextUrl) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: structuredClone(productContext)
      };
    }
    if(!documents.has(url)) {
      throw new Error(`Document is not allowlisted: ${url}`);
    }
    return {
      contextUrl: null,
      documentUrl: url,
      document: structuredClone(documents.get(url))
    };
  };
}

function addContexts(
  target: Map<string, unknown>,
  source: Map<string, unknown>
): void {
  for(const [url, context] of source) {
    target.set(url, context);
  }
}
import {readFile} from 'node:fs/promises';
import path from 'node:path';
