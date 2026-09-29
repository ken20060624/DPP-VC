import {gunzipSync, gzipSync} from 'node:zlib';
import {
  STATUS_LIST_BYTE_LENGTH,
  STATUS_LIST_ENTRY_COUNT
} from '../constants.js';

export function encodeStatusList(revokedIndices: number[]): string {
  const bitstring = Buffer.alloc(STATUS_LIST_BYTE_LENGTH);
  for(const index of revokedIndices) {
    assertIndex(index);
    const byteIndex = Math.floor(index / 8);
    const bitInByte = 7 - (index % 8);
    bitstring[byteIndex] = bitstring[byteIndex]! | (1 << bitInByte);
  }
  const compressed = gzipSync(bitstring);
  return `u${compressed.toString('base64url')}`;
}

export function decodeStatusList(encodedList: string): Buffer {
  if(!/^u[A-Za-z0-9_-]+$/.test(encodedList)) {
    throw new Error('Status list is not base64url multibase data.');
  }
  const bitstring = gunzipSync(Buffer.from(encodedList.slice(1), 'base64url'));
  if(bitstring.length < STATUS_LIST_BYTE_LENGTH) {
    throw new Error('Status list is shorter than 131,072 entries.');
  }
  return bitstring;
}

export function readStatusBit(bitstring: Buffer, index: number): boolean {
  assertIndex(index);
  if(bitstring.length < STATUS_LIST_BYTE_LENGTH) {
    throw new Error('Status list is shorter than 131,072 entries.');
  }
  const byteIndex = Math.floor(index / 8);
  const bitInByte = 7 - (index % 8);
  return (bitstring[byteIndex]! & (1 << bitInByte)) !== 0;
}

function assertIndex(index: number): void {
  if(!Number.isInteger(index) || index < 0 ||
    index >= STATUS_LIST_ENTRY_COUNT) {
    throw new Error('Status-list index is outside the supported range.');
  }
}
