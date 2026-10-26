/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  OpenDialogActionReturn,
  SlashCommand,
  LogoutActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import {
  clearCachedCredentialFile,
  getActiveAccount,
  selectAccount,
  DEFAULT_GEMINI_MODEL_AUTO,
} from '@google/gemini-cli-core';
import { SettingScope } from '../../config/settings.js';

const authLoginCommand: SlashCommand = {
  name: 'signin',
  altNames: ['login'],
  description: 'Sign in or change the authentication method',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (_context, _args): OpenDialogActionReturn => ({
    type: 'dialog',
    dialog: 'auth',
  }),
};

const authLogoutCommand: SlashCommand = {
  name: 'signout',
  altNames: ['logout'],
  description: 'Sign out (saved provider accounts remain available)',
  kind: CommandKind.BUILT_IN,
  action: async (context, _args): Promise<LogoutActionReturn> => {
    if (getActiveAccount()) {
      selectAccount(undefined);
      context.services.settings.refreshProviderAccount();
      context.services.agentContext?.config.setModel(
        context.services.settings.merged.model.name ??
          DEFAULT_GEMINI_MODEL_AUTO,
        true,
      );
      return { type: 'logout' };
    }

    await clearCachedCredentialFile();
    // Clear the selected auth type so user sees the auth selection menu
    context.services.settings.setValue(
      SettingScope.User,
      'security.auth.selectedType',
      undefined,
    );
    // Strip thoughts from history instead of clearing completely
    context.services.agentContext?.geminiClient.stripThoughtsFromHistory();
    // Return logout action to signal explicit state change
    return {
      type: 'logout',
    };
  },
};

export const authCommand: SlashCommand = {
  name: 'auth',
  description: 'Manage authentication',
  kind: CommandKind.BUILT_IN,
  subCommands: [authLoginCommand, authLogoutCommand],
  action: (context, args) =>
    // Default to login if no subcommand is provided
    authLoginCommand.action!(context, args),
};
