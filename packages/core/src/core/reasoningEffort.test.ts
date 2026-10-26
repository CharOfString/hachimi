/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { ThinkingLevel } from '@google/genai';
import type { Config } from '../config/config.js';
import type { ProviderAccount } from '../providers/types.js';
import {
  applyGeminiReasoningEffort,
  clampReasoningEffort,
  getGeminiEfforts,
  getProviderReasoningEffort,
  getSupportedReasoningEfforts,
  normalizeReasoningEffort,
} from './reasoningEffort.js';

describe('normalizeReasoningEffort', () => {
  it.each([
    ['low', 'low'],
    [' Med ', 'medium'],
    ['HIGH', 'high'],
    ['x-high', 'xhigh'],
    ['extra_high', 'xhigh'],
    ['maximum', 'max'],
  ])('maps %j to %s', (input, expected) => {
    expect(normalizeReasoningEffort(input)).toBe(expected);
  });

  it('rejects unknown and empty input', () => {
    expect(normalizeReasoningEffort('turbo')).toBeUndefined();
    expect(normalizeReasoningEffort('')).toBeUndefined();
    expect(normalizeReasoningEffort(undefined)).toBeUndefined();
  });
});

describe('clampReasoningEffort', () => {
  it('keeps supported tiers and passes through without a supported list', () => {
    expect(clampReasoningEffort('medium', ['low', 'medium'])).toBe('medium');
    expect(clampReasoningEffort('xhigh', [])).toBe('xhigh');
  });

  it('prefers the next stronger tier, else caps at the strongest', () => {
    expect(clampReasoningEffort('low', ['high', 'max'])).toBe('high');
    expect(clampReasoningEffort('medium', ['low', 'high'])).toBe('high');
    expect(clampReasoningEffort('max', ['low', 'medium', 'high'])).toBe('high');
  });
});

describe('getProviderReasoningEffort', () => {
  const tiered = {
    id: 'tiered',
    reasoning: {
      thinking: true,
      efforts: ['low', 'high', 'max'],
      defaultEffort: 'high',
    },
  };

  it('uses the preset default until the user picks a tier', () => {
    expect(getProviderReasoningEffort(tiered, undefined)).toBe('high');
    expect(getProviderReasoningEffort(tiered, 'medium')).toBe('high');
    expect(getProviderReasoningEffort(tiered, 'low')).toBe('low');
  });

  it('sends nothing for models without declared tiers', () => {
    expect(getProviderReasoningEffort({ id: 'plain' }, 'max')).toBeUndefined();
    expect(
      getProviderReasoningEffort(
        { id: 'toggle', reasoning: { thinking: true, toggleOnly: true } },
        'max',
      ),
    ).toBeUndefined();
  });
});

describe('Gemini thinking', () => {
  const level = { includeThoughts: true, thinkingLevel: ThinkingLevel.HIGH };
  const budget = { includeThoughts: true, thinkingBudget: 8192 };

  it('derives tiers from the thinking config shape', () => {
    expect(getGeminiEfforts('gemini-3-pro-preview', level)).toEqual([
      'low',
      'high',
    ]);
    expect(getGeminiEfforts('gemini-3.5-flash', level)).toEqual([
      'low',
      'medium',
      'high',
    ]);
    expect(getGeminiEfforts('gemini-2.5-pro', budget)).toHaveLength(5);
    expect(
      getGeminiEfforts('gemini-2.5-flash-lite', { thinkingBudget: 0 }),
    ).toEqual([]);
    expect(getGeminiEfforts('gemma', undefined)).toEqual([]);
  });

  it('maps tiers onto thinking levels with clamping', () => {
    expect(
      applyGeminiReasoningEffort('gemini-3.5-flash', level, 'medium'),
    ).toEqual({ includeThoughts: true, thinkingLevel: 'MEDIUM' });
    expect(
      applyGeminiReasoningEffort('gemini-3-pro-preview', level, 'medium'),
    ).toEqual({ includeThoughts: true, thinkingLevel: ThinkingLevel.HIGH });
    expect(
      applyGeminiReasoningEffort('gemini-3.5-flash', level, 'low'),
    ).toEqual({ includeThoughts: true, thinkingLevel: ThinkingLevel.LOW });
  });

  it('maps tiers onto Gemini 2.5 budgets', () => {
    expect(applyGeminiReasoningEffort('gemini-2.5-pro', budget, 'low')).toEqual(
      { includeThoughts: true, thinkingBudget: 1024 },
    );
    expect(applyGeminiReasoningEffort('gemini-2.5-pro', budget, 'max')).toEqual(
      { includeThoughts: true, thinkingBudget: 24576 },
    );
  });

  it('leaves the config untouched without a tier or adjustable thinking', () => {
    expect(
      applyGeminiReasoningEffort('gemini-2.5-pro', budget, undefined),
    ).toBe(budget);
    const off = { thinkingBudget: 0 };
    expect(applyGeminiReasoningEffort('gemini-2.5-flash', off, 'max')).toBe(
      off,
    );
    expect(
      applyGeminiReasoningEffort('gemma', undefined, 'max'),
    ).toBeUndefined();
  });
});

describe('getSupportedReasoningEfforts', () => {
  const configWith = (options: {
    model: string;
    account?: ProviderAccount;
    thinkingConfig?: object;
  }) =>
    ({
      getModel: () => options.model,
      getActiveModel: () => options.model,
      getContentGeneratorConfig: () => ({ providerAccount: options.account }),
      modelConfigService: {
        getResolvedConfig: () => ({
          model: options.model,
          generateContentConfig: { thinkingConfig: options.thinkingConfig },
        }),
      },
    }) as unknown as Config;

  const account = (protocol: ProviderAccount['protocol']): ProviderAccount => ({
    id: 'a',
    name: 'A',
    providerId: 'p',
    protocol,
    baseUrl: 'https://example.test',
    model: 'tiered',
    models: [
      {
        id: 'tiered',
        reasoning: { thinking: true, efforts: ['high', 'max', 'turbo'] },
      },
    ],
  });

  it('reads declared tiers for OpenAI-compatible accounts', () => {
    expect(
      getSupportedReasoningEfforts(
        configWith({ model: 'tiered', account: account('openai') }),
      ),
    ).toEqual(['high', 'max']);
  });

  it('reports no tiers for Anthropic accounts', () => {
    expect(
      getSupportedReasoningEfforts(
        configWith({ model: 'tiered', account: account('anthropic') }),
      ),
    ).toEqual([]);
  });

  it('uses the resolved thinking config for Gemini models', () => {
    expect(
      getSupportedReasoningEfforts(
        configWith({
          model: 'gemini-2.5-pro',
          thinkingConfig: { thinkingBudget: 8192 },
        }),
      ),
    ).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
  });
});
