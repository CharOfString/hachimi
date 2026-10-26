/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProviderProtocol = 'openai' | 'anthropic' | 'gemini';

export interface ProviderModel {
  id: string;
  contextWindowSize?: number;
  enableThinking?: boolean;
  thinkingMandatory?: boolean;
  reasoning?: {
    profile?: string;
    thinking?: boolean;
    efforts?: string[];
    defaultEffort?: string;
    canDisable?: boolean;
    toggleOnly?: boolean;
    disableField?: string;
  };
}

export interface ProviderPreset {
  id: string;
  label: string;
  protocol: ProviderProtocol;
  baseUrl:
    | string
    | Array<{
        id: string;
        label: string;
        url: string;
        documentationUrl?: string;
        apiKeyUrl?: string;
      }>;
  envKey: string;
  models: ProviderModel[];
}

export interface ProviderAccount {
  id: string;
  name: string;
  providerId: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  models: ProviderModel[];
  model: string;
}

export const PROVIDER_REASONING_PREFIX = 'hachimi:reasoning:';
