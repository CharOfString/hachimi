/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { terminalCapabilityManager } from '../utils/terminalCapabilityManager.js';
import os from 'node:os';
import { SettingScope } from '../../config/settings.js';
import { CommandKind, type SlashCommand } from './types.js';
import {
  readLogoFile,
  validateAsciiLogo,
  validatePngLogo,
} from '../utils/logo.js';

const USAGE = [
  '/logo off — Hide the logo (default).',
  '/logo ascii <file> — Use a UTF-8 text file as your logo.',
  '/logo kitty <file.png> — Use a PNG image in a Kitty graphics terminal.',
  'Changes apply immediately and are saved for future sessions.',
].join('\n');

export const logoCommand: SlashCommand = {
  name: 'logo',
  description: 'Configure an ASCII or Kitty image logo (off by default)',
  kind: CommandKind.BUILT_IN,
  action: async (context, args) => {
    const match = args.trim().match(/^(off|ascii|kitty)(?:\s+([\s\S]+))?$/);

    if (!match) {
      const terminal = terminalCapabilityManager.getTerminalName() ?? 'unknown';
      const graphics = terminalCapabilityManager.supportsKittyGraphics()
        ? 'supported'
        : 'not confirmed';
      const placeholders =
        terminalCapabilityManager.supportsKittyUnicodePlaceholders()
          ? 'supported'
          : 'not confirmed';

      return {
        type: 'message',
        messageType: 'info',
        content: `${USAGE}\n\nTerminal: ${terminal}\nKitty graphics: ${graphics}\nUnicode image placeholders: ${placeholders}`,
      };
    }

    const [, mode, argument] = match;

    try {
      if (mode === 'off') {
        context.services.settings.setValue(SettingScope.User, 'ui.logo', {
          mode: 'off',
        });
      } else {
        if (!argument) {
          throw new Error(USAGE);
        }

        const unquoted = argument.replace(/^(["'])([\s\S]*)\1$/, '$2');
        const filename = path.resolve(
          unquoted.startsWith('~/')
            ? path.join(os.homedir(), unquoted.slice(2))
            : unquoted,
        );
        const data = await readLogoFile(
          filename,
          mode === 'ascii' ? 16_384 : 2_097_152,
        );

        if (mode === 'ascii') {
          const text = validateAsciiLogo(data.toString('utf8'));
          context.services.settings.setValue(SettingScope.User, 'ui.logo', {
            mode,
            text,
          });
        } else {
          validatePngLogo(data);

          context.services.settings.setValue(SettingScope.User, 'ui.logo', {
            mode,
            image: filename,
          });
        }
      }

      return {
        type: 'message',
        messageType: 'info',
        content:
          mode === 'off'
            ? 'Logo hidden.'
            : `Logo set to ${mode} mode.${mode === 'kitty' ? ' Uses Kitty graphics; tmux needs allow-passthrough.' : ''}`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
