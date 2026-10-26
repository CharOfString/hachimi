/**
 * @license
 * Copyright 2025 Qwen
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

// The effort ladder, ranks, normalization and clamp are adapted from Qwen
// Code's packages/core/src/core/reasoning-effort.ts. The provider and Gemini
// mappings below are Hachimi additions.

import { ThinkingLevel, type ThinkingConfig } from '@google/genai';
import type { Config } from '../config/config.js';
import { resolveModel } from '../config/models.js';
import type { ProviderAccount, ProviderModel } from '../providers/types.js';

/**
 * Unified reasoning-effort ladder exposed to users via `/effort`. Each model
 * family maps a tier onto its own wire field, clamped to what it supports.
 */
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Ordered weakest → strongest. */
export const REASONING_EFFORT_TIERS: readonly ReasoningEffort[] = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
];

/** Numeric strength used when clamping a tier to what a model supports. */
const REASONING_EFFORT_RANKS: Record<ReasoningEffort, number> = {
  low: 20,
  medium: 30,
  high: 40,
  xhigh: 60,
  max: 70,
};

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return REASONING_EFFORT_TIERS.some((tier) => tier === value);
}

/**
 * Normalize free-form user input to a canonical tier, accepting separators and
 * a few aliases (`x-high`, `extra-high`, `maximum`).
 */
export function normalizeReasoningEffort(
  raw?: string | null,
): ReasoningEffort | undefined {
  if (!raw) {
    return undefined;
  }
  switch (
    raw
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '')
  ) {
    case 'low':
      return 'low';
    case 'medium':
    case 'med':
      return 'medium';
    case 'high':
      return 'high';
    case 'xhigh':
    case 'extrahigh':
      return 'xhigh';
    case 'max':
    case 'maximum':
      return 'max';
    default:
      return undefined;
  }
}

/**
 * Clamp a requested tier to the nearest supported one: keep an exact match,
 * otherwise prefer the next stronger supported tier, and fall back to the
 * strongest available when the request is above the model's ceiling.
 */
export function clampReasoningEffort(
  requested: ReasoningEffort,
  supported: readonly ReasoningEffort[],
): ReasoningEffort {
  if (supported.length === 0 || supported.includes(requested)) {
    return requested;
  }
  const requestedRank = REASONING_EFFORT_RANKS[requested];
  const ranked = [...supported].sort(
    (a, b) => REASONING_EFFORT_RANKS[a] - REASONING_EFFORT_RANKS[b],
  );
  return (
    ranked.find((tier) => REASONING_EFFORT_RANKS[tier] >= requestedRank) ??
    ranked[ranked.length - 1]
  );
}

/**
 * Tiers declared by a provider preset model. Models without declared efforts
 * (toggle-only, or custom models with no metadata) get no `reasoning_effort`.
 */
export function getProviderModelEfforts(
  model: ProviderModel | undefined,
): ReasoningEffort[] {
  return (model?.reasoning?.efforts ?? []).filter(isReasoningEffort);
}

/**
 * The `reasoning_effort` value for an OpenAI-compatible provider request: the
 * user's tier clamped to the model's declared tiers, else the preset default.
 */
export function getProviderReasoningEffort(
  model: ProviderModel,
  requested: ReasoningEffort | undefined,
): string | undefined {
  const efforts = getProviderModelEfforts(model);
  if (requested && efforts.length > 0) {
    return clampReasoningEffort(requested, efforts);
  }
  return model.reasoning?.defaultEffort;
}

// Gemini 3 Pro Preview accepts only LOW and HIGH thinking levels.
const GEMINI_LEVEL_TIERS = (model: string): ReasoningEffort[] =>
  /^gemini-3-pro\b/.test(model) ? ['low', 'high'] : ['low', 'medium', 'high'];

const GEMINI_LEVELS: Partial<Record<ReasoningEffort, ThinkingLevel>> = {
  low: ThinkingLevel.LOW,
  // Accepted by the API but not yet in the SDK's ThinkingLevel enum.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  medium: 'MEDIUM' as ThinkingLevel,
  high: ThinkingLevel.HIGH,
};

// Gemini 2.5 thinking budgets; max stays within every 2.5 model's limit.
const GEMINI_BUDGETS: Record<ReasoningEffort, number> = {
  low: 1024,
  medium: 4096,
  high: 8192,
  xhigh: 16384,
  max: 24576,
};

/**
 * Tiers a Gemini model supports, derived from the shape of its resolved
 * thinking config: level-based (Gemini 3) or budget-based (Gemini 2.5).
 */
export function getGeminiEfforts(
  model: string,
  thinkingConfig: ThinkingConfig | undefined,
): ReasoningEffort[] {
  if (thinkingConfig?.thinkingLevel !== undefined) {
    return GEMINI_LEVEL_TIERS(model);
  }
  if (
    thinkingConfig?.thinkingBudget !== undefined &&
    thinkingConfig.thinkingBudget !== 0
  ) {
    return [...REASONING_EFFORT_TIERS];
  }
  return [];
}

/**
 * Returns the thinking config with the user's tier applied, or the original
 * config when no tier is set or the model has no adjustable thinking.
 */
export function applyGeminiReasoningEffort(
  model: string,
  thinkingConfig: ThinkingConfig | undefined,
  requested: ReasoningEffort | undefined,
): ThinkingConfig | undefined {
  const efforts = getGeminiEfforts(model, thinkingConfig);
  if (!requested || efforts.length === 0) {
    return thinkingConfig;
  }
  const effort = clampReasoningEffort(requested, efforts);
  return thinkingConfig?.thinkingLevel !== undefined
    ? { ...thinkingConfig, thinkingLevel: GEMINI_LEVELS[effort] }
    : { ...thinkingConfig, thinkingBudget: GEMINI_BUDGETS[effort] };
}

function findProviderModel(
  account: ProviderAccount,
  model: string,
): ProviderModel | undefined {
  return (
    account.models.find((m) => m.id === model) ??
    account.models.find((m) => m.id === account.model)
  );
}

/** Tiers `/effort` can apply to the active model; empty when unsupported. */
export function getSupportedReasoningEfforts(
  config: Config,
): ReasoningEffort[] {
  const model = config.getModel();
  const account = config.getContentGeneratorConfig()?.providerAccount;
  if (account && account.protocol !== 'gemini') {
    return account.protocol === 'openai'
      ? getProviderModelEfforts(findProviderModel(account, model))
      : [];
  }
  // Resolve aliases such as `auto-gemini-3` the way GeminiChat does; routing
  // may still pick another model, whose request is clamped on its own.
  const geminiModel = resolveModel(
    config.getActiveModel(),
    config.getGemini31LaunchedSync?.() ?? false,
    false,
    config.getHasAccessToPreviewModel?.() ?? true,
    config,
    config.hasGemini35FlashGAAccess?.() ?? false,
  );
  const { generateContentConfig } = config.modelConfigService.getResolvedConfig(
    { model: geminiModel, isChatModel: true },
  );
  return getGeminiEfforts(geminiModel, generateContentConfig.thinkingConfig);
}
