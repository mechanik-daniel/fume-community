/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

import { FhirClient } from '@outburn/fhir-client';
import type { FhirVersion } from '@outburn/types';
import { createHash } from 'crypto';
import type { FhirConnectionConfig } from 'fumifier';
import { LRUCache } from 'lru-cache';

interface EffectiveFhirConnectionConfig {
  authType: 'NONE' | 'BASIC';
  username?: string;
  password?: string;
  fhirVersion: FhirVersion;
  timeout: number;
}

const getPoolCacheKey = (url: string, config: EffectiveFhirConnectionConfig): string => {
  // Hash credentials to avoid storing plaintext secrets in cache key
  const credentialTuple = `${config.username ?? ''}:${config.password ?? ''}`;
  const credentialHash = createHash('sha256').update(credentialTuple).digest('hex');
  return `${url}||${config.authType}||${credentialHash}||${config.fhirVersion}||${config.timeout}`;
};

const normalizeConnectionConfig = (
  url: string,
  config: FhirConnectionConfig | undefined,
  globalFhirVersion: FhirVersion,
  globalTimeout: number,
): EffectiveFhirConnectionConfig => {
  if (typeof config?.authType !== 'undefined' && config.authType !== 'NONE' && config.authType !== 'BASIC') {
    throw new Error(`Invalid authType for inline FHIR connection config for "${url}": expected "NONE" or "BASIC".`);
  }

  if (typeof config?.timeout !== 'undefined' && (!Number.isInteger(config.timeout) || config.timeout <= 0)) {
    throw new Error(`Invalid timeout for inline FHIR connection config for "${url}": expected a positive integer.`);
  }

  if (typeof config?.fhirVersion !== 'undefined' && (typeof config.fhirVersion !== 'string' || config.fhirVersion.length === 0)) {
    throw new Error(`Invalid fhirVersion for inline FHIR connection config for "${url}": expected a non-empty string.`);
  }

  if (typeof config?.username !== 'undefined' && (typeof config.username !== 'string' || config.username.length === 0)) {
    throw new Error(`Invalid username for inline FHIR connection config for "${url}": expected a non-empty string.`);
  }

  if (typeof config?.password !== 'undefined' && (typeof config.password !== 'string' || config.password.length === 0)) {
    throw new Error(`Invalid password for inline FHIR connection config for "${url}": expected a non-empty string.`);
  }

  const hasUsername = typeof config?.username !== 'undefined';
  const hasPassword = typeof config?.password !== 'undefined';
  const hasCredentials = hasUsername || hasPassword;
  const effectiveAuthType = config?.authType ?? (hasCredentials ? 'BASIC' : 'NONE');

  if (config?.authType === 'NONE' && hasCredentials) {
    throw new Error(`Inline FHIR connection config for "${url}" cannot provide username or password when authType is "NONE".`);
  }

  if (effectiveAuthType === 'BASIC' && (!hasUsername || !hasPassword)) {
    throw new Error(`Inline FHIR connection config for "${url}" requires both username and password when authType is "BASIC".`);
  }

  return {
    authType: effectiveAuthType,
    username: effectiveAuthType === 'BASIC' ? config?.username : undefined,
    password: effectiveAuthType === 'BASIC' ? config?.password : undefined,
    fhirVersion: (config?.fhirVersion ?? globalFhirVersion) as FhirVersion,
    timeout: config?.timeout ?? globalTimeout,
  };
};

export class FhirClientPool {
  private readonly cache: LRUCache<string, FhirClient>;
  private readonly globalFhirVersion: FhirVersion;
  private readonly globalTimeout: number;

  constructor(maxSize: number, globalFhirVersion: FhirVersion, globalTimeout: number) {
    const normalizedMaxSize = Number.isInteger(maxSize) && maxSize > 0 ? maxSize : 10;

    this.cache = new LRUCache<string, FhirClient>({
      max: normalizedMaxSize,
      allowStale: false,
    });
    this.globalFhirVersion = globalFhirVersion;
    this.globalTimeout = globalTimeout;
  }

  public get(url: string, config?: FhirConnectionConfig): FhirClient {
    const effectiveConfig = normalizeConnectionConfig(url, config, this.globalFhirVersion, this.globalTimeout);
    const cacheKey = getPoolCacheKey(url, effectiveConfig);
    const existingClient = this.cache.get(cacheKey);
    if (existingClient) {
      return existingClient;
    }

    const client = new FhirClient({
      baseUrl: url,
      fhirVersion: effectiveConfig.fhirVersion,
      timeout: effectiveConfig.timeout,
      auth: effectiveConfig.authType === 'BASIC'
        ? { username: effectiveConfig.username as string, password: effectiveConfig.password as string }
        : undefined,
    });

    this.cache.set(cacheKey, client);
    return client;
  }
}
