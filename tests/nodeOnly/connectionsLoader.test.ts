/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

import { describe, expect, test } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZodError } from 'zod';

import { FumeEngine } from '../../src/engine';
import { defaultConfig } from '../../src/serverConfig';
import type { ConnectionConfig, IConfig } from '../../src/types';
import { ConnectionsLoader } from '../../src/utils/connectionsLoader';

interface FhirClientAuth {
  username: string;
  password: string;
}

interface FhirClientConfigShape {
  baseUrl: string;
  fhirVersion: string;
  timeout: number;
  auth?: FhirClientAuth;
}

interface FhirClientShape {
  config: FhirClientConfigShape;
}

interface NamedClientFactoryContext {
  config: IConfig;
  getFhirVersion: () => string;
}

const makeTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'fume-connections-loader-'));

const writeConnectionsFile = (directory: string, content: string): string => {
  const filePath = path.join(directory, 'connections.yml');
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
};

const makeConfig = (connectionsFilePath?: string): IConfig => {
  return {
    ...defaultConfig,
    ...(connectionsFilePath ? { FHIR_CONNECTIONS_FILE: connectionsFilePath } : {}),
  };
};

describe('ConnectionsLoader', () => {
  test('loads valid YAML including NONE and BASIC auth entries', () => {
    const tempDir = makeTempDir();
    const filePath = writeConnectionsFile(tempDir, 'connections:\n  - name: publicServer\n    baseUrl: "https://r4.smarthealthit.org"\n    authType: NONE\n  - name: secureServer\n    baseUrl: "https://fhir.example.com/r4"\n    authType: BASIC\n    username: "alice"\n    password: "secret"\n    timeout: 12345\n');

    const loaded = ConnectionsLoader.load(makeConfig(filePath));

    expect(loaded).toHaveLength(2);
    expect(loaded[0]).toStrictEqual({
      name: 'publicServer',
      baseUrl: 'https://r4.smarthealthit.org',
      authType: 'NONE',
    });
    expect(loaded[1]).toStrictEqual({
      name: 'secureServer',
      baseUrl: 'https://fhir.example.com/r4',
      authType: 'BASIC',
      username: 'alice',
      password: 'secret',
      timeout: 12345,
    });
  });

  test('resolves ${ENV_VAR} placeholders from process.env', () => {
    process.env.FHIR_CONN_UN = 'env-user';
    process.env.FHIR_CONN_PW = 'env-pass';

    const tempDir = makeTempDir();
    const filePath = writeConnectionsFile(tempDir, 'connections:\n  - name: secureServer\n    baseUrl: "https://fhir.example.com/r4"\n    authType: BASIC\n    username: "${FHIR_CONN_UN}"\n    password: "${FHIR_CONN_PW}"\n');

    const loaded = ConnectionsLoader.load(makeConfig(filePath));

    expect(loaded[0].username).toBe('env-user');
    expect(loaded[0].password).toBe('env-pass');
  });

  test('returns empty array when connections file is missing', () => {
    const tempDir = makeTempDir();
    const missingPath = path.join(tempDir, 'does-not-exist.yml');

    const loaded = ConnectionsLoader.load(makeConfig(missingPath));

    expect(loaded).toStrictEqual([]);
  });

  test('throws descriptive error for missing environment variables', () => {
    delete process.env.MISSING_VAR;

    const tempDir = makeTempDir();
    const filePath = writeConnectionsFile(tempDir, 'connections:\n  - name: secureServer\n    baseUrl: "https://fhir.example.com/r4"\n    username: "${MISSING_VAR}"\n');

    expect(() => ConnectionsLoader.load(makeConfig(filePath))).toThrow(
      `Missing environment variable "MISSING_VAR" referenced in ${filePath}`
    );
  });

  test('throws zod validation error for invalid schema', () => {
    const tempDir = makeTempDir();
    const filePath = writeConnectionsFile(tempDir, `connections:\n  - name: missingBaseUrl\n`);

    expect(() => ConnectionsLoader.load(makeConfig(filePath))).toThrow(ZodError);
  });
});

describe('FumeEngine.createNamedFhirClient', () => {
  test('creates clients with correct merged settings for NONE and BASIC auth', () => {
    const context = {
      config: {
        ...defaultConfig,
        FHIR_SERVER_TIMEOUT: 30000,
        FHIR_VERSION: '4.0.1',
      },
      getFhirVersion: () => '4.0.1',
    } as NamedClientFactoryContext;

    const createNamedFhirClient = Reflect.get(FumeEngine.prototype, 'createNamedFhirClient') as
      ((this: NamedClientFactoryContext, connection: ConnectionConfig) => unknown);

    const basicConnection: ConnectionConfig = {
      name: 'secureServer',
      baseUrl: 'https://fhir.example.com/r4',
      authType: 'BASIC',
      username: 'alice',
      password: 'secret',
      timeout: 12345,
      fhirVersion: '5.0.0',
    };

    const noneConnection: ConnectionConfig = {
      name: 'publicServer',
      baseUrl: 'https://r4.smarthealthit.org',
      authType: 'NONE',
    };

    const basicClient = createNamedFhirClient.call(context, basicConnection) as FhirClientShape;
    const noneClient = createNamedFhirClient.call(context, noneConnection) as FhirClientShape;

    expect(basicClient.config.baseUrl).toBe('https://fhir.example.com/r4');
    expect(basicClient.config.fhirVersion).toBe('5.0.0');
    expect(basicClient.config.timeout).toBe(12345);
    expect(basicClient.config.auth).toStrictEqual({ username: 'alice', password: 'secret' });

    expect(noneClient.config.baseUrl).toBe('https://r4.smarthealthit.org');
    expect(noneClient.config.fhirVersion).toBe('4.0.1');
    expect(noneClient.config.timeout).toBe(30000);
    expect(noneClient.config.auth).toBeUndefined();
  });
});
