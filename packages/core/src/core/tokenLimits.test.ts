/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import type { ProviderAccount } from '../providers/types.js';
import { tokenLimit, DEFAULT_TOKEN_LIMIT } from './tokenLimits.js';
import {
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_MODEL,
  PREVIEW_GEMINI_FLASH_MODEL,
  PREVIEW_GEMINI_MODEL,
} from '../config/models.js';

describe('tokenLimit', () => {
  it('uses account context limits even for auxiliary Gemini model aliases', () => {
    const account: ProviderAccount = {
      id: 'test',
      name: 'test',
      providerId: 'custom',
      protocol: 'openai',
      baseUrl: 'https://example.com',
      model: 'small',
      models: [{ id: 'small', contextWindowSize: 16384 }, { id: 'unknown' }],
    };

    expect(tokenLimit('small', account)).toBe(16384);
    expect(tokenLimit('gemini-flash', account)).toBe(16384);
    expect(tokenLimit('unknown', account)).toBe(32768);
  });

  it('falls back to known limits when an account model has none', () => {
    const account: ProviderAccount = {
      id: 'test',
      name: 'test',
      providerId: 'custom',
      protocol: 'openai',
      baseUrl: 'https://example.com',
      model: 'gemini-3.1-pro-preview',
      models: [{ id: 'gemini-3.1-pro-preview' }, { id: 'glm-5' }],
    };

    expect(tokenLimit('gemini-3.1-pro-preview', account)).toBe(1_048_576);
    expect(tokenLimit('chat-compression-3-pro', account)).toBe(1_048_576);
    expect(tokenLimit('glm-5', account)).toBe(202752);
  });

  it('should return the correct token limit for default models', () => {
    expect(tokenLimit(DEFAULT_GEMINI_MODEL)).toBe(1_048_576);
    expect(tokenLimit(DEFAULT_GEMINI_FLASH_MODEL)).toBe(1_048_576);
    expect(tokenLimit(DEFAULT_GEMINI_FLASH_LITE_MODEL)).toBe(1_048_576);
  });

  it('should return the correct token limit for preview models', () => {
    expect(tokenLimit(PREVIEW_GEMINI_MODEL)).toBe(1_048_576);
    expect(tokenLimit(PREVIEW_GEMINI_FLASH_MODEL)).toBe(1_048_576);
  });

  it('should return the default token limit for an unknown model', () => {
    expect(tokenLimit('unknown-model')).toBe(DEFAULT_TOKEN_LIMIT);
  });

  it('should return the default token limit if no model is provided', () => {
    // @ts-expect-error testing invalid input
    expect(tokenLimit(undefined)).toBe(DEFAULT_TOKEN_LIMIT);
  });

  it('should have the correct default token limit value', () => {
    expect(DEFAULT_TOKEN_LIMIT).toBe(1_048_576);
  });
});
