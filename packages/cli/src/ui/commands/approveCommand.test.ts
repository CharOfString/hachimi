/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { PolicyEngine, ApprovalMode } from '@google/gemini-cli-core';
import { approveCommand } from './approveCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { SettingScope } from '../../config/settings.js';

const modeCommand = approveCommand.subCommands![0];

function setup() {
  const engine = new PolicyEngine({ approvalMode: ApprovalMode.AUTO_EDIT });
  const context = createMockCommandContext({
    services: {
      agentContext: {
        config: {
          getPolicyEngine: () => engine,
        },
      },
    },
  });

  return { engine, context };
}

describe('/approve mode', () => {
  it('reports hachimi as the default without writing settings', async () => {
    const { context } = setup();
    expect(await modeCommand.action!(context, '')).toMatchObject({
      content: expect.stringContaining('Approval policy mode: hachimi'),
    });
    expect(context.services.settings.setValue).not.toHaveBeenCalled();
  });

  it.each(['hachimi', 'default'])(
    'persists %s and applies it without changing the approval state',
    async (mode) => {
      const { context, engine } = setup();
      expect(await modeCommand.action!(context, mode)).toMatchObject({
        messageType: 'info',
      });
      expect(context.services.settings.setValue).toHaveBeenCalledWith(
        SettingScope.User,
        'general.approvalPolicyMode',
        mode,
      );
      expect(engine.getApprovalPolicyMode()).toBe(mode);
      expect(engine.getApprovalMode()).toBe(ApprovalMode.AUTO_EDIT);
    },
  );

  it('rejects unknown modes without changing settings', async () => {
    const { context, engine } = setup();
    expect(await modeCommand.action!(context, 'unknown')).toMatchObject({
      messageType: 'error',
    });
    expect(context.services.settings.setValue).not.toHaveBeenCalled();
    expect(engine.getApprovalPolicyMode()).toBe('hachimi');
  });

  it('keeps the active policy unchanged if saving fails', async () => {
    const { context, engine } = setup();
    vi.mocked(context.services.settings.setValue).mockImplementation(() => {
      throw new Error('cannot save');
    });
    expect(await modeCommand.action!(context, 'default')).toMatchObject({
      messageType: 'error',
    });
    expect(engine.getApprovalPolicyMode()).toBe('hachimi');
  });
});
