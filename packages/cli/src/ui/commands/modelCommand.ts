/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { createElement } from 'react';
import {
  getActiveAccount,
  AuthType,
  ModelSlashCommandEvent,
  logModelSlashCommand,
} from '@google/gemini-cli-core';
import { ProviderAccountsDialog } from '../auth/ProviderAccountsDialog.js';
import { SettingScope } from '../../config/settings.js';

import {
  type CommandContext,
  CommandKind,
  type SlashCommand,
} from './types.js';
import { MessageType } from '../types.js';

const setModelCommand: SlashCommand = {
  name: 'set',
  description:
    'Set the model to use. Usage: /model set <model-name> [--persist]',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  action: async (context: CommandContext, args: string) => {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: 'Usage: /model set <model-name> [--persist]',
      });
      return;
    }

    const modelName = parts[0];
    const persist = parts.includes('--persist');

    if (context.services.agentContext?.config) {
      const account = getActiveAccount();
      if (
        account &&
        context.services.settings.merged.security.auth.selectedType ===
          AuthType.PROVIDER_ACCOUNT &&
        !account.models.some((m) => m.id === modelName)
      ) {
        context.ui.addItem({
          type: MessageType.ERROR,
          text: 'Model is not configured for the active account. Edit its models in /auth first.',
        });

        return;
      }

      context.services.agentContext.config.setModel(modelName, !persist);
      const event = new ModelSlashCommandEvent(modelName);
      logModelSlashCommand(context.services.agentContext.config, event);

      context.ui.addItem({
        type: MessageType.INFO,
        text: `Model set to ${modelName}${persist ? ' (persisted)' : ''}`,
      });
    }
  },
};

const COMPRESS_USAGE =
  'Usage: /model compress [<model-name>|default] [--persist]';

const compressModelCommand: SlashCommand = {
  name: 'compress',
  description: `Set the model used to compress context. ${COMPRESS_USAGE}`,
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  action: async (context: CommandContext, args: string) => {
    const config = context.services.agentContext?.config;
    if (!config) {
      return;
    }

    const parts = args.trim().split(/\s+/).filter(Boolean);
    const persist = parts.includes('--persist');
    const names = parts.filter((part) => part !== '--persist');

    if (names.length === 0) {
      context.ui.addItem({
        type: MessageType.INFO,
        text: `Compression model: ${config.getCompressionModel() ?? 'default (the conversation model)'}\n${COMPRESS_USAGE}`,
      });
      return;
    }

    if (names.length > 1) {
      context.ui.addItem({ type: MessageType.ERROR, text: COMPRESS_USAGE });
      return;
    }

    const modelName = names[0] === 'default' ? undefined : names[0];
    const account = getActiveAccount();
    if (
      modelName &&
      account &&
      context.services.settings.merged.security.auth.selectedType ===
        AuthType.PROVIDER_ACCOUNT &&
      !account.models.some((m) => m.id === modelName)
    ) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: 'Model is not configured for the active account. Edit its models in /auth first.',
      });
      return;
    }

    if (persist) {
      context.services.settings.setValue(
        SettingScope.User,
        'model.compressionModel',
        modelName,
      );
    }
    config.setCompressionModel(modelName);

    context.ui.addItem({
      type: MessageType.INFO,
      text: `${modelName ? `Compression model set to ${modelName}` : 'Compression model reset to the conversation model'}${persist ? ' (persisted)' : ''}`,
    });
  },
};

const manageModelCommand: SlashCommand = {
  name: 'manage',
  description: 'Opens a dialog to configure the model',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext) => {
    const config = context.services.agentContext?.config;
    if (
      config &&
      getActiveAccount() &&
      context.services.settings.merged.security.auth.selectedType ===
        AuthType.PROVIDER_ACCOUNT
    ) {
      return {
        type: 'custom_dialog',
        component: createElement(ProviderAccountsDialog, {
          config,
          settings: context.services.settings,
          modelsOnly: true,
          onDone: () => context.ui.removeComponent(),
          onBack: () => context.ui.removeComponent(),
        }),
      };
    }

    if (context.services.agentContext?.config) {
      await context.services.agentContext.config.refreshUserQuota();
    }
    return {
      type: 'dialog',
      dialog: 'model',
    };
  },
};

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'Manage model configuration',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  subCommands: [manageModelCommand, setModelCommand, compressModelCommand],
  action: async (context: CommandContext, args: string) =>
    manageModelCommand.action!(context, args),
};
