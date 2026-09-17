import {access, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import {PROJECT_ROOT} from '../src/config.js';

const outputArgument = process.argv.find(argument =>
  argument.startsWith('--out='));
const force = process.argv.includes('--force');
const overwriteConfirmed = process.argv.includes('--confirm-overwrite');
const outputPath = path.resolve(
  PROJECT_ROOT,
  outputArgument?.slice('--out='.length) ?? './secrets/issuer-key.json'
);

if(await exists(outputPath)) {
  if(!force || !overwriteConfirmed) {
    throw new Error(
      `Key already exists at ${outputPath}. To rotate it intentionally, ` +
      'provide both --force and --confirm-overwrite.'
    );
  }
}

const keyPair = await Ed25519Multikey.generate();

const raw = await keyPair.export({
  publicKey: true,
  secretKey: true,
  includeContext: true
});
raw.controller = `did:key:${raw.publicKeyMultibase}`;
raw.id = `${raw.controller}#${raw.publicKeyMultibase}`;

await mkdir(path.dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(raw, null, 2)}\n`, {
  encoding: 'utf8',
  flag: force ? 'w' : 'wx'
});

console.log(`Generated issuer DID: ${raw.controller}`);
console.log(`Private key written to: ${outputPath}`);
console.log('The key file is ignored by Git. Do not commit or print its contents.');

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
