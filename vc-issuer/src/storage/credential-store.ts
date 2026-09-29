import {link, mkdir, readFile, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppError} from '../errors.js';
import type {ProductCredential} from '../vc/credential-types.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CredentialStore {
  save(credential: ProductCredential): Promise<void>;
  get(id: string): Promise<ProductCredential | null>;
}

export class FileCredentialStore implements CredentialStore {
  constructor(private readonly directory: string) {}

  async save(credential: ProductCredential): Promise<void> {
    const uuid = extractUuid(credential.id);
    await mkdir(this.directory, {recursive: true});
    const destination = this.pathFor(uuid);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    const content = `${JSON.stringify(credential, null, 2)}\n`;

    try {
      await writeFile(temporary, content, {encoding: 'utf8', flag: 'wx'});
      // Linking a fully written temporary file is atomic and refuses to
      // replace an existing credential with the same UUID.
      await link(temporary, destination);
      await unlink(temporary).catch(() => undefined);
    } catch(error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async get(id: string): Promise<ProductCredential | null> {
    const uuid = extractUuid(id);
    try {
      const content = await readFile(this.pathFor(uuid), 'utf8');
      return JSON.parse(content) as ProductCredential;
    } catch(error) {
      if(isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  private pathFor(uuid: string): string {
    return path.join(this.directory, `${uuid}.json`);
  }
}

export class NoopCredentialStore implements CredentialStore {
  async save(): Promise<void> {}
  async get(): Promise<null> {
    return null;
  }
}

function extractUuid(value: string): string {
  const uuid = value.startsWith('urn:uuid:') ? value.slice(9) : value;
  if(!UUID_PATTERN.test(uuid)) {
    throw new AppError({
      code: 'INVALID_CREDENTIAL_ID',
      message: 'Credential id must be a UUIDv4.',
      statusCode: 400
    });
  }
  return uuid;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
