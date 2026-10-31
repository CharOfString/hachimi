/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setModelContextWindow,
  tokenLimit,
  type MessageActionReturn,
} from '@google/gemini-cli-core';
import {
  CommandKind,
  type CommandContext,
  type SlashCommand,
} from './types.js';

const RESET_ARGS = new Set(['default', 'reset', 'auto']);
const CONTEXT_USAGE =
  'Usage: /declare context [<tokens>|1M|default], e.g. 262144, 256k, 1M';
const UNITS: Record<string, number> = { '': 1, k: 1_000, m: 1_000_000 };

export function parseContextWindowSize(input: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)([km]?)$/.exec(
    input.trim().toLowerCase().replace(/[,_]/g, ''),
  );
  if (!match) {
    return undefined;
  }

  const size = Math.round(Number(match[1]) * UNITS[match[2]]);
  return Number.isSafeInteger(size) && size > 0 ? size : undefined;
}

const message = (
  messageType: MessageActionReturn['messageType'],
  content: string,
): MessageActionReturn => ({ type: 'message', messageType, content });

function declareContext(
  context: CommandContext,
  args: string,
): MessageActionReturn {
  const config = context.services.agentContext?.config;
  if (!config) {
    return message('error', 'Configuration is not available yet.');
  }

  const account = config.getContentGeneratorConfig()?.providerAccount;
  if (!account) {
    return message(
      'error',
      'Context window overrides apply to provider accounts. Select one with /auth.',
    );
  }

  const model = config.getModel();
  const entry =
    account.models.find((m) => m.id === model) ??
    account.models.find((m) => m.id === account.model);
  if (!entry) {
    return message('error', 'Model not configured for this account.');
  }

  const input = args.trim().toLowerCase();
  if (!input) {
    const limit = tokenLimit(model, account).toLocaleString('en-US');
    const source =
      entry.contextWindowSize === undefined ? 'built-in' : 'declared';
    return message(
      'info',
      `Context window for ${entry.id}: ${limit} tokens (${source}).\n${CONTEXT_USAGE}`,
    );
  }

  const reset = RESET_ARGS.has(input);
  const size = reset ? undefined : parseContextWindowSize(input);
  if (!reset && !size) {
    return message('error', CONTEXT_USAGE);
  }

  try {
    setModelContextWindow(account.id, entry.id, size);
  } catch (error) {
    return message(
      'error',
      error instanceof Error ? error.message : String(error),
    );
  }

  if (size === undefined) {
    delete entry.contextWindowSize;
  } else {
    entry.contextWindowSize = size;
  }
  context.services.settings.refreshProviderAccount();

  const limit = tokenLimit(model, account).toLocaleString('en-US');
  return message(
    'info',
    reset
      ? `Context window override for ${entry.id} removed. Using ${limit} tokens.`
      : `Context window for ${entry.id}: ${limit} tokens. Saved.`,
  );
}

const contextCommand: SlashCommand = {
  name: 'context',
  description: "Show or override the current model's context window size",
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  action: declareContext,
};

export const declareCommand: SlashCommand = {
  name: 'declare',
  description: 'Declare properties of the current model',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  subCommands: [contextCommand],
  action: (context, args) => {
    const [name, ...rest] = args.trim().split(/\s+/);
    return name === 'context'
      ? declareContext(context, rest.join(' '))
      : message('error', CONTEXT_USAGE);
  },
};
