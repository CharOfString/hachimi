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
  type SlashCommandActionReturn,
} from './types.js';

function setShowver(
  context: CommandContext,
  args: string,
): SlashCommandActionReturn {
  const mode = args.trim().toLowerCase();
  const enabled =
    context.services.settings.merged.ui.showVersionHeader === true;

  if (!mode) {
    return {
      type: 'message',
      messageType: 'info',
      content: `Pinned version header: ${enabled ? 'on' : 'off'}.\n/showver on — pin the logo, version and authentication status.\n/showver off — restore the normal scrolling header.`,
    };
  }

  if (mode !== 'on' && mode !== 'off') {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Usage: /showver [on|off]',
    };
  }

  const nextEnabled = mode === 'on';
  context.services.settings.setValue(
    SettingScope.User,
    'ui.showVersionHeader',
    nextEnabled,
  );

  return {
    type: 'message',
    messageType: 'info',
    content: `Pinned version header ${nextEnabled ? 'enabled' : 'disabled'}. Restart Hachimi to apply the terminal layout.`,
  };
}

export const showverCommand: SlashCommand = {
  name: 'showver',
  description:
    'Pin the logo, version and authentication status (off by default)',
  kind: CommandKind.BUILT_IN,
  action: (context, args) => setShowver(context, args),
  subCommands: (['on', 'off'] as const).map((mode) => ({
    name: mode,
    description:
      mode === 'on' ? 'Pin version information' : 'Use the scrolling header',
    kind: CommandKind.BUILT_IN,
    autoExecute: true,
    action: (context: CommandContext) => setShowver(context, mode),
  })),
};
