import {readFile} from 'node:fs/promises';
import path from 'node:path';
import jsQR from 'jsqr';
import {PNG} from 'pngjs';
import {describe, expect, it} from 'vitest';
import {hasValidGtinCheckDigit} from '../src/models/product-schema.js';

const decodeQr = jsQR as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number
) => {data: string} | null;

interface Device {
  id: string;
  gtin: string;
  serialNumber: string;
  targetUrl: string;
  qrImagePath: string;
}

const repositoryRoot = path.resolve(process.cwd(), '..');

describe('cross-branch GS1 fixtures', () => {
  it('keeps UI/DPP mock data identical to the canonical product fixture',
    async () => {
      const canonical = await readJson('fixtures/products/fan-001.json');
      const lapo = await readJson('Desktop/Lapo/lapo.java');
      expect(lapo).toEqual(canonical);
    });

  it('uses valid GTIN-14 values and matching Digital Link identifiers',
    async () => {
      const devices = await readJson('scripts/devices.json') as Device[];
      const canonical = await readJson('fixtures/products/fan-001.json') as {
        id: string;
        gtin: string;
        serialNumber: string;
      };
      expect(devices[0]).toMatchObject({
        gtin: canonical.gtin,
        serialNumber: canonical.serialNumber,
        targetUrl: canonical.id
      });

      for(const device of devices) {
        expect(hasValidGtinCheckDigit(device.gtin)).toBe(true);
        expect(device.targetUrl).toBe(
          `https://dpp-demo.example.com/01/${device.gtin}/21/${device.serialNumber}`
        );
      }
    });

  it('encodes each current target URL in its checked-in QR image', async () => {
    const devices = await readJson('scripts/devices.json') as Device[];
    for(const device of devices) {
      const imagePath = path.join(
        repositoryRoot,
        device.qrImagePath.replace(/^\//, '')
      );
      const png = PNG.sync.read(await readFile(imagePath));
      const result = decodeQr(
        new Uint8ClampedArray(png.data),
        png.width,
        png.height
      );
      expect(result?.data).toBe(device.targetUrl);
    }
  });
});

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(
    path.join(repositoryRoot, relativePath),
    'utf8'
  ));
}
