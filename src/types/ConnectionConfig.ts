/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

export type ConnectionAuthType = 'NONE' | 'BASIC'

export interface ConnectionConfig {
  name: string
  baseUrl: string
  fhirVersion?: string
  authType?: ConnectionAuthType
  username?: string
  password?: string
  timeout?: number
}

export interface ConnectionsFile {
  connections: ConnectionConfig[]
}