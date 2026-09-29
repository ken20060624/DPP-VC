import {createHash, randomBytes} from 'node:crypto';

const apiKey = randomBytes(32).toString('base64url');
const digest = createHash('sha256').update(apiKey, 'utf8').digest('hex');

process.stdout.write([
  'Save the plaintext key in the authorized client; it is shown once:',
  apiKey,
  '',
  'Set this service environment value:',
  `OPERATOR_API_KEY_SHA256=${digest}`,
  ''
].join('\n'));
