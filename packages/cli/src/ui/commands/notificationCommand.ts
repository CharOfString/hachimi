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

function setNotificationMode(
  context: CommandContext,
  args: string,
): MessageActionReturn {
  const mode = args.trim().toLowerCase();
  const enabled =
    context.services.settings.merged.general.enableNotifications !== false;

  if (!mode) {
    return {
      type: 'message',
      messageType: 'info',
      content: `Notifications: ${enabled ? 'on' : 'off'}.\n/notification on — notify when approval is required.\n/notification off — disable notifications.`,
    };
  }

  if (mode !== 'on' && mode !== 'off') {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Usage: /notification [on|off]',
    };
  }

  try {
    const nextEnabled = mode === 'on';
    context.services.settings.setValue(
      SettingScope.User,
      'general.enableNotifications',
      nextEnabled,
    );

    return {
      type: 'message',
      messageType: 'info',
      content: `Notifications ${nextEnabled ? 'enabled' : 'disabled'}.`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: error instanceof Error ? error.message : String(error),
    };
  }
}

export const notificationCommand: SlashCommand = {
  name: 'notification',
  description: 'Configure approval notifications (on by default)',
  kind: CommandKind.BUILT_IN,
  action: setNotificationMode,
  subCommands: ['on', 'off'].map((mode) => ({
    name: mode,
    description:
      mode === 'on'
        ? 'Notify when approval is required'
        : 'Disable notifications',
    kind: CommandKind.BUILT_IN,
    action: (context: CommandContext) => setNotificationMode(context, mode),
  })),
};
