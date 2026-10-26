/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingScope } from '../../config/settings.js';
import {
  CommandKind,
  type CommandContext,
  type SlashCommand,
} from './types.js';
import type { MessageActionReturn } from '@google/gemini-cli-core';

function changeMode(
  context: CommandContext,
  args: string,
): MessageActionReturn {
  const engine = context.services.agentContext?.config.getPolicyEngine();

  if (!engine) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Approval policy is not available yet.',
    };
  }

  const mode = args.trim().toLowerCase();

  if (!mode) {
    return {
      type: 'message',
      messageType: 'info',
      content: `Approval policy mode: ${engine.getApprovalPolicyMode()}\n/approve mode hachimi — Hachimi approval rules and Shift+Tab cycle (default).\n/approve mode default — classic Gemini approval rules and Shift+Tab cycle.`,
    };
  }

  if (mode !== 'hachimi' && mode !== 'default') {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Usage: /approve mode [hachimi|default]',
    };
  }

  try {
    context.services.settings.setValue(
      SettingScope.User,
      'general.approvalPolicyMode',
      mode,
    );
    engine.setApprovalPolicyMode(mode);

    return {
      type: 'message',
      messageType: 'info',
      content: `Approval policy mode: ${mode}. Saved and applied to subsequent tool calls.`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: error instanceof Error ? error.message : String(error),
    };
  }
}

export const approveCommand: SlashCommand = {
  name: 'approve',
  description: 'Configure approval policy behavior',
  kind: CommandKind.BUILT_IN,
  action: (context) => changeMode(context, ''),
  subCommands: [
    {
      name: 'mode',
      description: 'Select the Hachimi or classic Gemini approval mechanism',
      kind: CommandKind.BUILT_IN,
      action: changeMode,
      subCommands: ['hachimi', 'default'].map((mode) => ({
        name: mode,
        description:
          mode === 'hachimi'
            ? 'Use Hachimi approval behavior'
            : 'Use classic Gemini approval behavior',
        kind: CommandKind.BUILT_IN,
        action: (context: CommandContext) => changeMode(context, mode),
      })),
    },
  ],
};
