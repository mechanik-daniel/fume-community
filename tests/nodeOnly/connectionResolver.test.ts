/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

import { describe, expect, test } from '@jest/globals';

import { FumeEngine } from '../../src/engine';

interface FhirClientLike {
  id: string;
}

interface FhirConnectionConfig {
  authType?: 'NONE' | 'BASIC';
  username?: string;
  password?: string;
  fhirVersion?: string;
  timeout?: number;
}

interface UrlPoolLike {
  get: (url: string, config?: FhirConnectionConfig) => FhirClientLike;
}

type Resolver = (target: string | null, config?: FhirConnectionConfig) => FhirClientLike;

interface ResolverContext {
  fhirClient?: FhirClientLike;
  namedClients: Map<string, FhirClientLike>;
  urlClientPool?: UrlPoolLike;
}

describe('FumeEngine.createConnectionResolver', () => {
  test('returns default client when target is null', () => {
    const defaultClient = { id: 'default-client' };
    const context: ResolverContext = {
      fhirClient: defaultClient,
      namedClients: new Map(),
    };

    const createConnectionResolver = Reflect.get(FumeEngine.prototype, 'createConnectionResolver') as
      ((this: ResolverContext) => Resolver);

    const resolver = createConnectionResolver.call(context);
    expect(resolver(null)).toBe(defaultClient);
  });

  test('returns named client when target is a known connection name', () => {
    const namedClient = { id: 'named-client' };
    const context: ResolverContext = {
      fhirClient: { id: 'default-client' },
      namedClients: new Map([['primary', namedClient]]),
    };

    const createConnectionResolver = Reflect.get(FumeEngine.prototype, 'createConnectionResolver') as
      ((this: ResolverContext) => Resolver);

    const resolver = createConnectionResolver.call(context);
    expect(resolver('primary')).toBe(namedClient);
  });

  test('returns pooled URL client when target is an http url', () => {
    const pooledClient = { id: 'pooled-client' };
    const pool: UrlPoolLike = {
      get: (url, config) => {
        expect(url).toBe('https://r4.smarthealthit.org');
        expect(config).toStrictEqual({
          authType: 'BASIC',
          username: 'alice',
          password: 'secret',
          fhirVersion: '5.0.0',
          timeout: 1234,
        });
        return pooledClient;
      },
    };

    const context: ResolverContext = {
      fhirClient: { id: 'default-client' },
      namedClients: new Map(),
      urlClientPool: pool,
    };

    const createConnectionResolver = Reflect.get(FumeEngine.prototype, 'createConnectionResolver') as
      ((this: ResolverContext) => Resolver);

    const resolver = createConnectionResolver.call(context);
    expect(resolver('https://r4.smarthealthit.org', {
      authType: 'BASIC',
      username: 'alice',
      password: 'secret',
      fhirVersion: '5.0.0',
      timeout: 1234,
    })).toBe(pooledClient);
  });

  test('throws when named connection receives inline URL config', () => {
    const namedClient = { id: 'named-client' };
    const context: ResolverContext = {
      fhirClient: { id: 'default-client' },
      namedClients: new Map([['primary', namedClient]]),
    };

    const createConnectionResolver = Reflect.get(FumeEngine.prototype, 'createConnectionResolver') as
      ((this: ResolverContext) => Resolver);

    const resolver = createConnectionResolver.call(context);
    expect(() => resolver('primary', { timeout: 1000 })).toThrow(
      'Inline FHIR connection config is only supported for URL targets. Configure named connection "primary" in connections.yml.'
    );
  });

  test('throws for unknown named connection', () => {
    const context: ResolverContext = {
      fhirClient: { id: 'default-client' },
      namedClients: new Map(),
      urlClientPool: {
        get: () => ({ id: 'pooled-client' }),
      },
    };

    const createConnectionResolver = Reflect.get(FumeEngine.prototype, 'createConnectionResolver') as
      ((this: ResolverContext) => Resolver);

    const resolver = createConnectionResolver.call(context);
    expect(() => resolver('unknown')).toThrow('Unknown FHIR connection name: "unknown"');
  });
});
