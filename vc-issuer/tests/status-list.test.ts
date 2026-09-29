import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {
  decodeStatusList,
  encodeStatusList,
  readStatusBit
} from '../src/status/bitstring.js';
import {FileStatusListStore} from '../src/status/status-list-store.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

describe('Bitstring Status List v1.0 storage and encoding', () => {
  it('uses left-most bit ordering in a 131,072-entry bitstring', () => {
    const bits = decodeStatusList(encodeStatusList([0, 7, 8, 131_071]));
    expect(bits.length).toBe(16_384);
    expect(bits[0]).toBe(0x81);
    expect(bits[1]).toBe(0x80);
    expect(bits[16_383]).toBe(0x01);
    expect(readStatusBit(bits, 0)).toBe(true);
    expect(readStatusBit(bits, 1)).toBe(false);
    expect(readStatusBit(bits, 131_071)).toBe(true);
  });

  it('keeps indexes unique across store instances and revokes idempotently',
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'status-store-'));
      cleanups.push(() => rm(root, {recursive: true, force: true}));
      const values = [7, 7, 8];
      const first = new FileStatusListStore(root, () => values.shift()!);
      expect(await first.reserve('urn:uuid:first')).toBe(7);
      expect(await first.reserve('urn:uuid:second')).toBe(8);

      const restartedValues = [7, 9];
      const restarted = new FileStatusListStore(
        root,
        () => restartedValues.shift()!
      );
      expect(await restarted.reserve('urn:uuid:third')).toBe(9);
      expect(await restarted.revoke('urn:uuid:first', 7)).toEqual({
        statusListIndex: 7,
        alreadyRevoked: false
      });
      expect(await restarted.revoke('urn:uuid:first', 7)).toEqual({
        statusListIndex: 7,
        alreadyRevoked: true
      });
      expect(await restarted.isRevoked(7)).toBe(true);
      expect(await restarted.revokedIndices()).toEqual([7]);
    });
});
