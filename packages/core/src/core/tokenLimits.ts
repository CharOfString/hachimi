/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_MODEL,
  PREVIEW_GEMINI_FLASH_MODEL,
  PREVIEW_GEMINI_MODEL,
  GEMMA_4_31B_IT_MODEL,
  GEMMA_4_26B_A4B_IT_MODEL,
} from '../config/models.js';

import type { ProviderAccount } from '../providers/types.js';
import { PROVIDER_PRESETS } from '../providers/presets.js';

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 1_048_576;
export const GEMMA_4_TOKEN_LIMIT = 256_000;

export function tokenLimit(
  model: Model,
  account?: ProviderAccount,
): TokenCount {
  if (account) {
    const selected =
      account.models.find((entry) => entry.id === model) ??
      account.models.find((entry) => entry.id === account.model);
    const id = selected?.id ?? account.model;
    return (
      selected?.contextWindowSize ??
      PROVIDER_PRESETS.flatMap((preset) => preset.models).find(
        (entry) => entry.id === id && entry.contextWindowSize,
      )?.contextWindowSize ??
      (id.startsWith('gemini-') ? tokenLimit(id) : 32768)
    );
  }

  // Add other models as they become relevant or if specified by config
  // Pulled from https://ai.google.dev/gemini-api/docs/models
  switch (model) {
    case GEMMA_4_31B_IT_MODEL:
    case GEMMA_4_26B_A4B_IT_MODEL:
      return GEMMA_4_TOKEN_LIMIT;
    case PREVIEW_GEMINI_MODEL:
    case PREVIEW_GEMINI_FLASH_MODEL:
    case DEFAULT_GEMINI_MODEL:
    case DEFAULT_GEMINI_FLASH_MODEL:
    case DEFAULT_GEMINI_FLASH_LITE_MODEL:
      return 1_048_576;
    default:
      return DEFAULT_TOKEN_LIMIT;
  }
}
