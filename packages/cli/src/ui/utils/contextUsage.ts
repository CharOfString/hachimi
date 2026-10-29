/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { tokenLimit } from '@google/gemini-cli-core';

type ProviderAccount = Parameters<typeof tokenLimit>[1];

export function getContextTokenLimit(
  model: string | undefined,
  account?: ProviderAccount,
): number {
  if (!model || typeof model !== 'string' || model.length === 0) {
    return 0;
  }
  return tokenLimit(model, account);
}

export function getContextUsagePercentage(
  promptTokenCount: number,
  model: string | undefined,
  account?: ProviderAccount,
): number {
  const limit = getContextTokenLimit(model, account);
  if (limit <= 0) {
    return 0;
  }
  return promptTokenCount / limit;
}

export function isContextUsageHigh(
  promptTokenCount: number,
  model: string | undefined,
  threshold = 0.6,
): boolean {
  return getContextUsagePercentage(promptTokenCount, model) > threshold;
}
