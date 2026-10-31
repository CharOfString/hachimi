/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderAccount } from '@google/gemini-cli-core';
import { declareCommand, parseContextWindowSize } from './declareCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

const { mockSet } = vi.hoisted(() => ({ mockSet: vi.fn() }));
vi.mock('@google/gemini-cli-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@google/gemini-cli-core')>()),
  setModelContextWindow: mockSet,
}));

function setup(account?: ProviderAccount) {
  const config = {
    getModel: () => account?.model ?? 'gemini-2.5-pro',
    getContentGeneratorConfig: () => ({ providerAccount: account }),
  };
  const refreshProviderAccount = vi.fn();
  const context = createMockCommandContext({
    services: {
      agentContext: { config },
      settings: { refreshProviderAccount },
    },
  });
  return { context, refreshProviderAccount };
}

const providerAccount = (): ProviderAccount => ({
  id: '5fcd2146-0000-4000-8000-000000000000',
  name: 'Relay',
  providerId: 'custom',
  protocol: 'openai',
  baseUrl: 'https://relay.example/v1',
  model: '[mt]q|次/kimi-k3.1-pro',
  models: [{ id: '[mt]q|次/kimi-k3.1-pro' }, { id: 'other' }],
});

const run = (context: ReturnType<typeof setup>['context'], args: string) =>
  declareCommand.action!(context, args);

beforeEach(() => {
  mockSet.mockReset();
});

describe('parseContextWindowSize', () => {
  it.each([
    ['262144', 262_144],
    ['1M', 1_000_000],
    ['1m', 1_000_000],
    ['256k', 256_000],
    ['1.5M', 1_500_000],
    ['1,048,576', 1_048_576],
  ])('parses %s', (input, expected) => {
    expect(parseContextWindowSize(input)).toBe(expected);
  });

  it.each(['', '0', '-5', 'abc', '1g', '1M tokens'])('rejects %s', (input) => {
    expect(parseContextWindowSize(input)).toBeUndefined();
  });
});

describe('/declare context', () => {
  it('reports the fallback limit when nothing is declared', async () => {
    const { context } = setup(providerAccount());
    expect(await run(context, 'context')).toMatchObject({
      messageType: 'info',
      content: expect.stringContaining('32,768 tokens (built-in)'),
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('saves 1M for the current model and applies it immediately', async () => {
    const account = providerAccount();
    const { context, refreshProviderAccount } = setup(account);
    expect(await run(context, 'context 1M')).toMatchObject({
      messageType: 'info',
      content: expect.stringContaining('1,000,000 tokens. Saved.'),
    });
    expect(mockSet).toHaveBeenCalledWith(
      account.id,
      '[mt]q|次/kimi-k3.1-pro',
      1_000_000,
    );
    expect(account.models[0].contextWindowSize).toBe(1_000_000);
    expect(account.models[1].contextWindowSize).toBeUndefined();
    expect(refreshProviderAccount).toHaveBeenCalled();
    expect(await run(context, 'context')).toMatchObject({
      content: expect.stringContaining('(declared)'),
    });
  });

  it('removes the override with default', async () => {
    const account = providerAccount();
    account.models[0].contextWindowSize = 1_000_000;
    const { context } = setup(account);
    expect(await run(context, 'context default')).toMatchObject({
      messageType: 'info',
      content: expect.stringContaining('removed. Using 32,768 tokens'),
    });
    expect(mockSet).toHaveBeenCalledWith(
      account.id,
      '[mt]q|次/kimi-k3.1-pro',
      undefined,
    );
    expect(account.models[0].contextWindowSize).toBeUndefined();
  });

  it('rejects invalid sizes without saving', async () => {
    const account = providerAccount();
    const { context } = setup(account);
    expect(await run(context, 'context lots')).toMatchObject({
      messageType: 'error',
      content: expect.stringContaining('Usage: /declare context'),
    });
    expect(mockSet).not.toHaveBeenCalled();
    expect(account.models[0].contextWindowSize).toBeUndefined();
  });

  it('keeps the in-memory limit when saving fails', async () => {
    mockSet.mockImplementation(() => {
      throw new Error('Cannot read Hachimi accounts.');
    });
    const account = providerAccount();
    const { context } = setup(account);
    expect(await run(context, 'context 1m')).toMatchObject({
      messageType: 'error',
      content: 'Cannot read Hachimi accounts.',
    });
    expect(account.models[0].contextWindowSize).toBeUndefined();
  });

  it('explains that Gemini models are not overridden', async () => {
    const { context } = setup();
    expect(await run(context, 'context 1M')).toMatchObject({
      messageType: 'error',
      content: expect.stringContaining('provider accounts'),
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('shows usage for unknown declarations', async () => {
    const { context } = setup(providerAccount());
    expect(await run(context, 'speed 9000')).toMatchObject({
      messageType: 'error',
    });
  });
});
