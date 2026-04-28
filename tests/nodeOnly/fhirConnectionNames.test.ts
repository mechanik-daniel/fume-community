/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

import { describe, expect, test } from '@jest/globals';
import { Buffer } from 'buffer';

import { FumeEngine } from '../../src/engine';
import type { FumeEngineCreateOptions, IConfig } from '../../src/types';

const encodeConnections = (yaml: string): string => Buffer.from(yaml, 'utf8').toString('base64');

const makeCreateOptions = (connectionsFile: string): FumeEngineCreateOptions<IConfig> => ({
  config: {
    FHIR_PACKAGE_CACHE_DIR: 'tests/.fhir-packages',
    FHIR_CONNECTIONS_FILE: connectionsFile
  }
});

describe('FumeEngine $fhirConnectionNames()', () => {
  test('returns an empty array when no named connections are configured', async () => {
    const engine = await FumeEngine.create(makeCreateOptions('./tests/nodeOnly/does-not-exist-connections.yml'));

    await expect(engine.transform({}, '$fhirConnectionNames()')).resolves.toStrictEqual([]);
  });

  test('returns configured named connection names in order and excludes connection details', async () => {
    const engine = await FumeEngine.create(makeCreateOptions(
      encodeConnections(`fhir:\n  - name: serverA\n    baseUrl: "https://server-a.example.com/fhir"\n    authType: BASIC\n    username: "alice"\n    password: "secret-a"\n  - name: serverB\n    baseUrl: "https://server-b.example.com/fhir"\n    authType: NONE\n`)
    ));

    await expect(engine.transform({}, '$fhirConnectionNames()')).resolves.toStrictEqual(['serverA', 'serverB']);
  });

  test('rejects duplicate named connections during engine initialization', async () => {
    await expect(FumeEngine.create(makeCreateOptions(
      encodeConnections(`fhir:\n  - name: duplicate\n    baseUrl: "https://server-a.example.com/fhir"\n  - name: duplicate\n    baseUrl: "https://server-b.example.com/fhir"\n`)
    ))).rejects.toThrow('Duplicate FHIR connection name(s): duplicate. Connection names must be unique.');
  });
});