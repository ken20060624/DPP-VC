import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {afterEach, describe, expect, it} from 'vitest';

const execFileAsync = promisify(execFile);
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

describe('local one-click launcher', () => {
  it('creates a stable local operator key and prints only its digest',
    async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), 'dpp-launcher-'));
      cleanups.push(() => rm(directory, {recursive: true, force: true}));
      const keyPath = path.join(directory, 'operator-api-key.txt');
      const scriptPath = path.resolve(
        process.cwd(),
        'scripts',
        'setup-local-operator-key.mjs'
      );

      const first = await execFileAsync(process.execPath, [
        scriptPath,
        `--key-path=${keyPath}`
      ]);
      const key = (await readFile(keyPath, 'utf8')).trim();
      const expectedDigest = createHash('sha256')
        .update(key, 'utf8')
        .digest('hex');
      expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(first.stdout).toBe(expectedDigest);
      expect(first.stdout).not.toContain(key);

      const second = await execFileAsync(process.execPath, [
        scriptPath,
        `--key-path=${keyPath}`
      ]);
      expect(second.stdout).toBe(expectedDigest);
      expect((await readFile(keyPath, 'utf8')).trim()).toBe(key);
    });

  it('keeps secrets out of the committed batch launcher', async () => {
    const launcherPath = path.resolve(
      process.cwd(),
      '..',
      '啟動-VC操作台.bat'
    );
    const launcher = await readFile(launcherPath, 'utf8');
    expect(launcher).toContain('setup-local-operator-key.mjs');
    expect(launcher).toContain('npm start');
    expect(launcher).toContain('http://127.0.0.1:3000/operator/');
    expect(launcher).not.toMatch(/OPERATOR_API_KEY_SHA256=[0-9a-f]{64}/);
  });
});
