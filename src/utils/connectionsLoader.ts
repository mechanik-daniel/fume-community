/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { z } from 'zod';

import type { ConnectionConfig, IConfig } from '../types';

const envPlaceholderPattern = /\$\{([A-Z0-9_]+)\}/g;
const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

type ConnectionsSourceKind = 'default-file' | 'configured-file' | 'inline-base64' | 'missing-file';

interface LoadedConnectionsResult {
	connections: ConnectionConfig[];
	sourceKind: ConnectionsSourceKind;
	sourceDescription: string;
}

const ConnectionConfigSchema = z
	.object({
		name: z.string().min(1),
		baseUrl: z.string().url(),
		fhirVersion: z.string().min(1).optional(),
		authType: z.enum(['NONE', 'BASIC']).optional().default('NONE'),
		username: z.string().min(1).optional(),
		password: z.string().min(1).optional(),
		timeout: z.number().int().positive().optional(),
	})
	.superRefine((connection, ctx) => {
		if (connection.authType === 'BASIC') {
			if (!connection.username) {
				ctx.addIssue({
					code: 'custom',
					path: ['username'],
					message: 'username is required when authType is BASIC',
				});
			}
			if (!connection.password) {
				ctx.addIssue({
					code: 'custom',
					path: ['password'],
					message: 'password is required when authType is BASIC',
				});
			}
		}

		if (connection.authType === 'NONE') {
			if (connection.username) {
				ctx.addIssue({
					code: 'custom',
					path: ['username'],
					message: 'username must not be provided when authType is NONE',
				});
			}
			if (connection.password) {
				ctx.addIssue({
					code: 'custom',
					path: ['password'],
					message: 'password must not be provided when authType is NONE',
				});
			}
		}
	});

const ConnectionsFileSchema = z.object({
	fhir: z.array(ConnectionConfigSchema),
});

const resolveConnectionsFilePath = (config: IConfig): string => {
	const configuredPath = config.FHIR_CONNECTIONS_FILE?.trim();
	if (!configuredPath) {
		return path.resolve(process.cwd(), './connections.yml');
	}
	return path.resolve(process.cwd(), configuredPath);
};

const isPathLikeValue = (value: string): boolean => {
	return path.isAbsolute(value)
		|| value.startsWith('.')
		|| value.startsWith('..')
		|| value.includes('/')
		|| value.includes('\\')
		|| value.endsWith('.yml')
		|| value.endsWith('.yaml');
};

const tryDecodeBase64 = (value: string): string | null => {
	const normalized = value.trim();
	if (normalized.length === 0 || normalized.length % 4 !== 0 || !base64Pattern.test(normalized)) {
		return null;
	}

	try {
		const decoded = Buffer.from(normalized, 'base64').toString('utf8');
		const reEncoded = Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/u, '');
		if (reEncoded !== normalized.replace(/=+$/u, '')) {
			return null;
		}
		return decoded;
	} catch {
		return null;
	}
};

const resolveRawConnectionsSource = (config: IConfig): { raw: string; sourceKind: ConnectionsSourceKind; sourceDescription: string } => {
	const configuredValue = config.FHIR_CONNECTIONS_FILE?.trim();
	if (!configuredValue) {
		const defaultFilePath = resolveConnectionsFilePath(config);
		if (!fs.existsSync(defaultFilePath)) {
			return {
				raw: '',
				sourceKind: 'missing-file',
				sourceDescription: defaultFilePath,
			};
		}

		return {
			raw: fs.readFileSync(defaultFilePath, 'utf8'),
			sourceKind: 'default-file',
			sourceDescription: defaultFilePath,
		};
	}

	const resolvedPath = resolveConnectionsFilePath(config);
	if (fs.existsSync(resolvedPath)) {
		return {
			raw: fs.readFileSync(resolvedPath, 'utf8'),
			sourceKind: 'configured-file',
			sourceDescription: resolvedPath,
		};
	}

	const decodedBase64 = tryDecodeBase64(configuredValue);
	if (decodedBase64 !== null) {
		return {
			raw: decodedBase64,
			sourceKind: 'inline-base64',
			sourceDescription: 'inline base64 value from FHIR_CONNECTIONS_FILE',
		};
	}

	if (isPathLikeValue(configuredValue)) {
		return {
			raw: '',
			sourceKind: 'missing-file',
			sourceDescription: resolvedPath,
		};
	}

	throw new Error('FHIR_CONNECTIONS_FILE must be either an existing file path or a base64-encoded YAML document.');
};

const resolveEnvPlaceholders = (raw: string, sourceDescription: string): string => {
	return raw.replace(envPlaceholderPattern, (match, variableName: string) => {
		const envValue = process.env[variableName];
		if (typeof envValue !== 'string') {
			throw new Error(`Missing environment variable "${variableName}" referenced in ${sourceDescription}`);
		}
		return envValue;
	});
};

const parseConnectionsYaml = (raw: string): ConnectionConfig[] => {
	const parsedYaml = yaml.load(raw);
	if (parsedYaml && typeof parsedYaml === 'object' && !Array.isArray(parsedYaml) && 'connections' in parsedYaml && !('fhir' in parsedYaml)) {
		throw new Error('Named FHIR connections now use a top-level "fhir" node instead of "connections".');
	}

	const parsed = ConnectionsFileSchema.parse(parsedYaml);
	return parsed.fhir;
};

export class ConnectionsLoader {
	public static load(config: IConfig): ConnectionConfig[] {
		return ConnectionsLoader.loadWithMetadata(config).connections;
	}

	public static loadWithMetadata(config: IConfig): LoadedConnectionsResult {
		const source = resolveRawConnectionsSource(config);
		if (source.sourceKind === 'missing-file') {
			return {
				connections: [],
				sourceKind: source.sourceKind,
				sourceDescription: source.sourceDescription,
			};
		}

		const withResolvedEnv = resolveEnvPlaceholders(source.raw, source.sourceDescription);
		return {
			connections: parseConnectionsYaml(withResolvedEnv),
			sourceKind: source.sourceKind,
			sourceDescription: source.sourceDescription,
		};
	}
}
