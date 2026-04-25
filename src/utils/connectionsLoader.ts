/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';
import { z } from 'zod';

import type { ConnectionConfig, IConfig } from '../types';

const envPlaceholderPattern = /\$\{([A-Z0-9_]+)\}/g;

const ConnectionConfigSchema = z.object({
	name: z.string().min(1),
	baseUrl: z.string().url(),
	fhirVersion: z.string().min(1).optional(),
	authType: z.enum(['NONE', 'BASIC']).optional().default('NONE'),
	username: z.string().min(1).optional(),
	password: z.string().min(1).optional(),
	timeout: z.number().int().positive().optional(),
});

const ConnectionsFileSchema = z.object({
	connections: z.array(ConnectionConfigSchema),
});

const resolveConnectionsFilePath = (config: IConfig): string => {
	const configuredPath = config.FHIR_CONNECTIONS_FILE?.trim();
	if (!configuredPath) {
		return path.resolve(process.cwd(), './connections.yml');
	}
	return path.resolve(process.cwd(), configuredPath);
};

const resolveEnvPlaceholders = (raw: string, filePath: string): string => {
	return raw.replace(envPlaceholderPattern, (match, variableName: string) => {
		const envValue = process.env[variableName];
		if (typeof envValue !== 'string') {
			throw new Error(`Missing environment variable \"${variableName}\" referenced in ${filePath}`);
		}
		return envValue;
	});
};

export class ConnectionsLoader {
	public static load(config: IConfig): ConnectionConfig[] {
		const filePath = resolveConnectionsFilePath(config);
		if (!fs.existsSync(filePath)) {
			return [];
		}

		const raw = fs.readFileSync(filePath, 'utf8');
		const withResolvedEnv = resolveEnvPlaceholders(raw, filePath);
		const parsedYaml = yaml.load(withResolvedEnv);
		const parsed = ConnectionsFileSchema.parse(parsedYaml);
		return parsed.connections;
	}
}
