/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { ReasoningEffort } from '@google/gemini-cli-core';
import { effortCommand } from './effortCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { SettingScope } from '../../config/settings.js';

const { mockSupported } = vi.hoisted(() => ({
  mockSupported: vi.fn<() => ReasoningEffort[]>(),
}));
vi.mock('@google/gemini-cli-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@google/gemini-cli-core')>()),
  getSupportedReasoningEfforts: mockSupported,
}));

function setup(supported: ReasoningEffort[], initial?: ReasoningEffort) {
  mockSupported.mockReturnValue(supported);
  let effort = initial;
  const config = {
    getModel: () => 'deepseek-v4-pro',
    getReasoningEffort: vi.fn(() => effort),
    setReasoningEffort: vi.fn((next?: ReasoningEffort) => {
      effort = next;
    }),
  };
  const context = createMockCommandContext({
    services: { agentContext: { config } },
  });
  return { config, context };
}

const run = (context: ReturnType<typeof setup>['context'], args: string) =>
  effortCommand.action!(context, args);

describe('/effort', () => {
  it('reports the current tier and model support without writing settings', async () => {
    const { context } = setup(['high', 'max'], 'max');
    expect(await run(context, '')).toMatchObject({
      messageType: 'info',
      content: expect.stringMatching(
        /Reasoning effort: max\n.*deepseek-v4-pro supports: high, max/,
      ),
    });
    expect(context.services.settings.setValue).not.toHaveBeenCalled();
  });

  it('persists and applies a tier, noting the clamp for the model', async () => {
    const { context, config } = setup(['high', 'max']);
    expect(await run(context, 'Low')).toMatchObject({
      messageType: 'info',
      content: expect.stringContaining('requests use high'),
    });
    expect(context.services.settings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'model.reasoningEffort',
      'low',
    );
    expect(config.setReasoningEffort).toHaveBeenCalledWith('low');
  });

  it('accepts aliases and explains unsupported models', async () => {
    const { context, config } = setup([]);
    expect(await run(context, 'extra-high')).toMatchObject({
      content: expect.stringContaining('has no adjustable reasoning effort'),
    });
    expect(config.setReasoningEffort).toHaveBeenCalledWith('xhigh');
  });

  it('resets to model defaults', async () => {
    const { context, config } = setup(['high'], 'high');
    const reset = effortCommand.subCommands!.find((c) => c.name === 'default')!;
    expect(await reset.action!(context, '')).toMatchObject({
      content: expect.stringContaining('reset'),
    });
    expect(context.services.settings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'model.reasoningEffort',
      undefined,
    );
    expect(config.setReasoningEffort).toHaveBeenCalledWith(undefined);
  });

  it('rejects unknown tiers without changing anything', async () => {
    const { context, config } = setup(['high']);
    expect(await run(context, 'turbo')).toMatchObject({
      messageType: 'error',
      content: expect.stringContaining('Usage: /effort'),
    });
    expect(context.services.settings.setValue).not.toHaveBeenCalled();
    expect(config.setReasoningEffort).not.toHaveBeenCalled();
  });

  it('does not apply the tier when saving settings fails', async () => {
    const { context, config } = setup(['high']);
    vi.mocked(context.services.settings.setValue).mockImplementation(() => {
      throw new Error('read-only settings');
    });
    expect(await run(context, 'high')).toMatchObject({
      messageType: 'error',
      content: 'read-only settings',
    });
    expect(config.setReasoningEffort).not.toHaveBeenCalled();
  });
});
