/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  REASONING_EFFORT_TIERS,
  clampReasoningEffort,
  getSupportedReasoningEfforts,
  normalizeReasoningEffort,
  type Config,
  type MessageActionReturn,
} from '@google/gemini-cli-core';
import { SettingScope } from '../../config/settings.js';
import {
  CommandKind,
  type CommandContext,
  type SlashCommand,
} from './types.js';

const RESET_ARGS = new Set(['default', 'reset', 'auto']);
const USAGE = `Usage: /effort [${REASONING_EFFORT_TIERS.join('|')}|default]`;

function describeModel(config: Config): string {
  const model = config.getModel();
  const supported = getSupportedReasoningEfforts(config);
  return supported.length > 0
    ? `${model} supports: ${supported.join(', ')}`
    : `${model} has no adjustable reasoning effort`;
}

function setEffort(context: CommandContext, args: string): MessageActionReturn {
  const config = context.services.agentContext?.config;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration is not available yet.',
    };
  }

  const input = args.trim().toLowerCase();
  if (!input) {
    const current = config.getReasoningEffort();
    return {
      type: 'message',
      messageType: 'info',
      content: `Reasoning effort: ${current ?? "default (each model's own)"}\n${describeModel(config)}.\n${USAGE}`,
    };
  }

  const reset = RESET_ARGS.has(input);
  const effort = reset ? undefined : normalizeReasoningEffort(input);
  if (!reset && !effort) {
    return { type: 'message', messageType: 'error', content: USAGE };
  }

  try {
    context.services.settings.setValue(
      SettingScope.User,
      'model.reasoningEffort',
      effort,
    );
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: error instanceof Error ? error.message : String(error),
    };
  }
  config.setReasoningEffort(effort);

  if (!effort) {
    return {
      type: 'message',
      messageType: 'info',
      content:
        'Reasoning effort reset. Each model uses its own default from the next request.',
    };
  }

  const supported = getSupportedReasoningEfforts(config);
  const applied =
    supported.length > 0 ? clampReasoningEffort(effort, supported) : undefined;
  const note = !applied
    ? ` ${describeModel(config)}, so it applies after switching to one that does.`
    : applied !== effort
      ? ` ${describeModel(config)}; requests use ${applied}.`
      : '';
  return {
    type: 'message',
    messageType: 'info',
    content: `Reasoning effort: ${effort}. Saved and applied from the next request.${note}`,
  };
}

export const effortCommand: SlashCommand = {
  name: 'effort',
  description: 'Show or set how hard reasoning models think',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  action: setEffort,
  subCommands: [...REASONING_EFFORT_TIERS, 'default'].map((tier) => ({
    name: tier,
    description:
      tier === 'default'
        ? "Use each model's default effort"
        : `Set reasoning effort to ${tier}`,
    kind: CommandKind.BUILT_IN,
    autoExecute: true,
    action: (context: CommandContext) => setEffort(context, tier),
  })),
};
