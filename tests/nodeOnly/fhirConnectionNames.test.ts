/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

import { describe, expect, test } from '@jest/globals';
import { Buffer } from 'buffer';

import { FumeEngine } from '../../src/engine';

const encodeConnections = (yaml: string): string => Buffer.from(yaml, 'utf8').toString('base64');

describe('FumeEngine $fhirConnectionNames()', () => {
  test('returns an empty array when no named connections are configured', async () => {
    const engine = await FumeEngine.create({
      config: {
        FHIR_PACKAGE_CACHE_DIR: 'tests/.fhir-packages',
        FHIR_CONNECTIONS_FILE: './tests/nodeOnly/does-not-exist-connections.yml'
      } as any
    });

    await expect(engine.transform({}, '$fhirConnectionNames()')).resolves.toStrictEqual([]);
  });

  test('returns configured named connection names in order and excludes connection details', async () => {
    const engine = await FumeEngine.create({
      config: {
        FHIR_PACKAGE_CACHE_DIR: 'tests/.fhir-packages',
        FHIR_CONNECTIONS_FILE: encodeConnections(`fhir:\n  - name: serverA\n    baseUrl: "https://server-a.example.com/fhir"\n    authType: BASIC\n    username: "alice"\n    password: "secret-a"\n  - name: serverB\n    baseUrl: "https://server-b.example.com/fhir"\n    authType: NONE\n`)
      } as any
    });

    await expect(engine.transform({}, '$fhirConnectionNames()')).resolves.toStrictEqual(['serverA', 'serverB']);
  });
});