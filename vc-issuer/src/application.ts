import {readFile} from 'node:fs/promises';
import path from 'node:path';
import cors from '@fastify/cors';
import Fastify, {
  type FastifyInstance,
  type FastifyRequest
} from 'fastify';
import type {AppConfig} from './config.js';
import {PROJECT_ROOT} from './config.js';
import {
  DID_DOCUMENT_PATH,
  PRODUCT_CONTEXT_PATH,
  STATUS_LIST_PATH
} from './constants.js';
import {ApiKeyAuthenticator} from './auth/api-key-auth.js';
import {AppError, asSafeError} from './errors.js';
import {DidKeyProvider} from './identity/did-key-provider.js';
import {DidWebProvider} from './identity/did-web-provider.js';
import type {IssuerIdentity} from './identity/issuer-identity-provider.js';
import {parseAndValidateProduct} from './models/product-schema.js';
import {StatusListService} from './status/status-list-service.js';
import {FileStatusListStore} from './status/status-list-store.js';
import {
  FileCredentialStore,
  NoopCredentialStore,
  type CredentialStore
} from './storage/credential-store.js';
import {CredentialBuilder, type Clock} from './vc/credential-builder.js';
import {CredentialIssuer} from './vc/credential-issuer.js';
import type {ProductCredential} from './vc/credential-types.js';
import {CredentialVerifier} from './vc/credential-verifier.js';

interface Services {
  identity: IssuerIdentity;
  issuer: CredentialIssuer;
  verifier: CredentialVerifier;
  store: CredentialStore;
  builder: CredentialBuilder;
  statusList: StatusListService;
}

export interface BuildApplicationOptions {
  config: AppConfig;
  clock?: Clock;
  idGenerator?: () => string;
  statusIndexGenerator?: () => number;
  loggerEnabled?: boolean;
}

export async function buildApplication(
  options: BuildApplicationOptions
): Promise<FastifyInstance> {
  const {config} = options;
  const clock = options.clock ?? (() => new Date());
  const authenticator = new ApiKeyAuthenticator(
    config.operatorApiKeySha256
  );
  let services: Services | undefined;
  let initializationError: string | undefined;

  try {
    const identityProvider = config.issuerDidMethod === 'web' ?
      new DidWebProvider(
        config.issuerPrivateKeyPath,
        config.issuerDidWeb!,
        config.issuerVerificationMethodFragment
      ) :
      new DidKeyProvider(config.issuerPrivateKeyPath);
    const identity = await identityProvider.load();
    const builder = new CredentialBuilder(
      clock,
      options.idGenerator,
      config.productContextUrl
    );
    const issuer = new CredentialIssuer(
      identity,
      builder,
      clock,
      config.productContextUrl
    );
    const statusList = new StatusListService(
      new FileStatusListStore(
        config.statusListStorePath,
        options.statusIndexGenerator
      ),
      identity,
      config.publicBaseUrl,
      clock
    );
    const verifier = new CredentialVerifier(
      identity,
      statusList,
      clock,
      config.productContextUrl
    );
    const store = config.credentialStoreEnabled ?
      new FileCredentialStore(config.credentialStorePath) :
      new NoopCredentialStore();
    services = {identity, issuer, verifier, store, builder, statusList};
  } catch {
    initializationError = 'Issuer identity is not ready.';
  }

  const logger = options.loggerEnabled === false ? false : {
    redact: {
      paths: [
        'req.headers.authorization',
        '*.secretKeyMultibase',
        '*.privateKey',
        '*.token'
      ],
      censor: '[REDACTED]'
    }
  };
  const app = Fastify({
    logger,
    bodyLimit: 1024 * 1024
  });

  app.setErrorHandler((error, _request, reply) => {
    const safe = asSafeError(error);
    if(safe.code === 'AUTHENTICATION_REQUIRED') {
      reply.header('WWW-Authenticate', 'Bearer realm="vc-issuer"');
    }
    if(safe.statusCode >= 500) {
      app.log.error({code: safe.code}, safe.message);
    }
    void reply.status(safe.statusCode).send({
      error: {
        code: safe.code,
        message: safe.message,
        ...(safe.details === undefined ? {} : {details: safe.details})
      }
    });
  });

  app.addHook('onRequest', async request => {
    const origin = request.headers.origin;
    if(origin && !config.corsOrigins.includes(origin)) {
      throw new AppError({
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'The request origin is not allowed.',
        statusCode: 403
      });
    }
  });

  await app.register(cors, {
    origin(origin, callback) {
      if(!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError({
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'The request origin is not allowed.',
        statusCode: 403
      }), false);
    }
  });

  app.get('/health', async () => ({status: 'ok'}));

  app.get('/ready', async (_request, reply) => {
    if(!services) {
      return reply.status(503).send({
        status: 'not-ready',
        error: initializationError
      });
    }
    return {
      status: 'ready',
      issuer: services.identity.did,
      didMethod: config.issuerDidMethod,
      cryptosuite: 'eddsa-jcs-2022',
      statusList: services.statusList.statusListUrl
    };
  });

  app.get(PRODUCT_CONTEXT_PATH, async (_request, reply) => {
    const contextPath = path.join(
      PROJECT_ROOT, 'contexts', 'product-v1.jsonld'
    );
    const context = JSON.parse(await readFile(contextPath, 'utf8')) as unknown;
    return reply
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .type('application/ld+json')
      .send(context);
  });

  app.get(DID_DOCUMENT_PATH, async (_request, reply) => {
    if(config.issuerDidMethod !== 'web') {
      throw new AppError({
        code: 'DID_WEB_DISABLED',
        message: 'The did:web document is not enabled.',
        statusCode: 404
      });
    }
    const current = requireServices(services);
    return reply
      .header('Cache-Control', 'public, max-age=300')
      .type('application/did+ld+json')
      .send(current.identity.controllerDocument);
  });

  app.get(STATUS_LIST_PATH, async (_request, reply) => {
    const current = requireServices(services);
    const credential = await current.statusList.createCredential();
    return reply
      .header('Cache-Control', 'public, max-age=60')
      .type('application/vc+ld+json')
      .send(credential);
  });

  app.post('/api/v1/credentials/issue', async (request, reply) => {
    authenticator.assertAuthorized(request.headers.authorization);
    const current = requireServices(services);
    const body = request.body as {product?: unknown} | undefined;
    const product = parseAndValidateProduct(body?.product);
    const credentialId = current.builder.createCredentialId();
    const credentialStatus = await current.statusList.createEntry(credentialId);
    const credential = await current.issuer.issue(
      product,
      credentialStatus,
      credentialId
    );
    const selfCheck = await current.verifier.verify(credential);
    if(!selfCheck.verified) {
      throw new AppError({
        code: 'ISSUANCE_SELF_CHECK_FAILED',
        message: 'The newly issued credential could not be verified.',
        statusCode: 500
      });
    }
    await current.store.save(credential);
    return reply.status(201).send({credential});
  });

  app.post('/api/v1/credentials/verify', async request => {
    const current = requireServices(services);
    const body = request.body as {credential?: unknown} | undefined;
    return current.verifier.verify(body?.credential);
  });

  app.post('/api/v1/credentials/:id/revoke', async (request, reply) => {
    authenticator.assertAuthorized(request.headers.authorization);
    const current = requireServices(services);
    if(!config.credentialStoreEnabled) {
      throw new AppError({
        code: 'STORAGE_DISABLED',
        message: 'Credential storage is required for revocation.',
        statusCode: 409
      });
    }
    const id = getIdParameter(request);
    const credential = await current.store.get(id);
    if(!credential) {
      throw new AppError({
        code: 'CREDENTIAL_NOT_FOUND',
        message: 'Credential was not found.',
        statusCode: 404
      });
    }
    const result = await current.statusList.revoke(credential);
    return reply.send({
      credentialId: credential.id,
      status: 'revoked',
      statusListIndex: String(result.statusListIndex),
      alreadyRevoked: result.alreadyRevoked
    });
  });

  app.get('/api/v1/credentials/:id', async (request, reply) => {
    const current = requireServices(services);
    if(!config.credentialStoreEnabled) {
      throw new AppError({
        code: 'STORAGE_DISABLED',
        message: 'Credential storage is disabled.',
        statusCode: 404
      });
    }
    const id = getIdParameter(request);
    const credential = await current.store.get(id);
    if(!credential) {
      throw new AppError({
        code: 'CREDENTIAL_NOT_FOUND',
        message: 'Credential was not found.',
        statusCode: 404
      });
    }
    return reply.send({credential});
  });

  return app;
}

function requireServices(services: Services | undefined): Services {
  if(!services) {
    throw new AppError({
      code: 'SERVICE_NOT_READY',
      message: 'The issuer identity is not ready.',
      statusCode: 503
    });
  }
  return services;
}

function getIdParameter(request: FastifyRequest): string {
  const params = request.params as {id?: unknown};
  if(typeof params.id !== 'string') {
    throw new AppError({
      code: 'INVALID_CREDENTIAL_ID',
      message: 'Credential id must be a UUIDv4.',
      statusCode: 400
    });
  }
  return params.id;
}

export type {ProductCredential};
