import {createHash, randomBytes} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const keyPathArgument = process.argv.find(argument =>
  argument.startsWith('--key-path='));
const keyPath = path.resolve(
  projectRoot,
  keyPathArgument?.slice('--key-path='.length) ??
    './secrets/operator-api-key.txt'
);

const apiKey = await loadOrCreateKey(keyPath);
const digest = createHash('sha256').update(apiKey, 'utf8').digest('hex');
process.stdout.write(digest);

async function loadOrCreateKey(filePath) {
  let existing;
  try {
    existing = (await readFile(filePath, 'utf8')).trim();
  } catch(error) {
    if(error?.code !== 'ENOENT') {
      throw error;
    }
  }

  if(existing !== undefined) {
    if(!/^[A-Za-z0-9_-]{43}$/.test(existing)) {
      throw new Error(
        `Operator API Key at ${filePath} is malformed. ` +
        'Move it aside and run the launcher again.'
      );
    }
    return existing;
  }

  const generated = randomBytes(32).toString('base64url');
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${generated}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600
  });
  return generated;
}
