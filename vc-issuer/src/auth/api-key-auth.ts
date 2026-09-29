import {createHash, timingSafeEqual} from 'node:crypto';
import {AppError} from '../errors.js';

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

export class ApiKeyAuthenticator {
  private readonly expectedDigest: Buffer;

  constructor(expectedDigestHex: string) {
    if(!SHA256_HEX_PATTERN.test(expectedDigestHex)) {
      throw new Error('Operator API key digest must be SHA-256 hex.');
    }
    this.expectedDigest = Buffer.from(expectedDigestHex, 'hex');
  }

  assertAuthorized(authorization: string | undefined): void {
    const token = extractBearerToken(authorization);
    const suppliedDigest = createHash('sha256')
      .update(token ?? '', 'utf8')
      .digest();
    const matches = timingSafeEqual(suppliedDigest, this.expectedDigest);
    if(!token || !matches) {
      throw new AppError({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'A valid operator bearer token is required.',
        statusCode: 401
      });
    }
  }
}

function extractBearerToken(value: string | undefined): string | undefined {
  if(!value) {
    return undefined;
  }
  const match = /^Bearer ([\x21-\x7e]+)$/.exec(value);
  return match?.[1];
}
