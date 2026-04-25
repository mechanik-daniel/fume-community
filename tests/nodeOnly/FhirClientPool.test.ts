/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

import { describe, expect, test } from '@jest/globals';
import type { FhirVersion } from '@outburn/types';

import { FhirClientPool } from '../../src/utils/FhirClientPool';

interface FhirClientConfigShape {
  baseUrl: string;
  fhirVersion: string;
  timeout: number;
  auth?: {
    username?: string;
    password?: string;
  };
}

interface FhirClientShape {
  config: FhirClientConfigShape;
}

interface FhirConnectionConfig {
  authType?: 'NONE' | 'BASIC';
  username?: string;
  password?: string;
  fhirVersion?: FhirVersion;
  timeout?: number;
}

describe('FhirClientPool', () => {
  test('returns the same instance for the same URL and same effective config', () => {
    const pool = new FhirClientPool(10, '4.0.1', 30000);
    const config: FhirConnectionConfig = {
      authType: 'BASIC',
      username: 'alice',
      password: 'secret',
      fhirVersion: '5.0.0',
      timeout: 1234,
    };

    const first = pool.get('https://fhir.example.com/r4', config) as unknown as FhirClientShape;
    const second = pool.get('https://fhir.example.com/r4', { ...config }) as unknown as FhirClientShape;

    expect(second).toBe(first);
    expect(second.config.baseUrl).toBe('https://fhir.example.com/r4');
    expect(second.config.fhirVersion).toBe('5.0.0');
    expect(second.config.timeout).toBe(1234);
    expect(second.config.auth).toStrictEqual({ username: 'alice', password: 'secret' });
  });

  test('returns different instances for same URL with different fhirVersion', () => {
    const pool = new FhirClientPool(10, '4.0.1', 30000);

    const first = pool.get('https://fhir.example.com/r4', { fhirVersion: '4.0.1' });
    const second = pool.get('https://fhir.example.com/r4', { fhirVersion: '5.0.0' });

    expect(second).not.toBe(first);
  });

  test('returns different instances for same URL with different timeout', () => {
    const pool = new FhirClientPool(10, '4.0.1', 30000);

    const first = pool.get('https://fhir.example.com/r4', { timeout: 1000 });
    const second = pool.get('https://fhir.example.com/r4', { timeout: 2000 });

    expect(second).not.toBe(first);
  });

  test('returns different instances for same URL with different credentials', () => {
    const pool = new FhirClientPool(10, '4.0.1', 30000);

    const first = pool.get('https://fhir.example.com/r4', { username: 'alice', password: 'secret-1' });
    const second = pool.get('https://fhir.example.com/r4', { username: 'alice', password: 'secret-2' });

    expect(second).not.toBe(first);
  });

  test('rejects invalid timeout values', () => {
    const pool = new FhirClientPool(10, '4.0.1', 30000);

    expect(() => pool.get('https://fhir.example.com/r4', { timeout: 0 })).toThrow(
      'Invalid timeout for inline FHIR connection config for "https://fhir.example.com/r4": expected a positive integer.'
    );
  });

  test('evicts least recently used entry when max size is exceeded', () => {
    const pool = new FhirClientPool(2, '4.0.1', 30000);

    const first = pool.get('https://fhir1.example.com/r4');
    pool.get('https://fhir2.example.com/r4');
    pool.get('https://fhir3.example.com/r4');

    const firstAgain = pool.get('https://fhir1.example.com/r4');
    expect(firstAgain).not.toBe(first);
  });

  test('with maxSize=1, requesting two URLs evicts the first and recreates it', () => {
    const pool = new FhirClientPool(1, '4.0.1', 30000);

    const first = pool.get('https://fhir1.example.com/r4');
    pool.get('https://fhir2.example.com/r4');
    const firstAgain = pool.get('https://fhir1.example.com/r4');

    expect(firstAgain).not.toBe(first);
  });
});
