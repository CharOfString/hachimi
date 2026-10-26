/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { Storage } from '../config/storage.js';

export const LANGUAGE_PREFERENCE_FILENAME = 'LANGUAGE_PREFERENCE.md';

export function getLanguagePreferenceFilePath(): string {
  return path.join(Storage.getGlobalGeminiDir(), LANGUAGE_PREFERENCE_FILENAME);
}

function readStdioTtyPath(): string | undefined {
  for (const fd of [1, 0]) {
    try {
      return fs.readlinkSync(`/proc/self/fd/${fd}`);
    } catch {
      // Not linkable (e.g. closed fd or no procfs); try the next one.
    }
  }
  return undefined;
}

/**
 * Detects the Linux virtual console (e.g. Ctrl+Alt+F3), whose kernel font
 * cannot render CJK and most other non-Latin scripts.
 */
export function isLinuxVirtualConsole(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  readTtyPath: () => string | undefined = readStdioTtyPath,
): boolean {
  if (env['TERM'] === 'linux') {
    return true;
  }
  if (platform !== 'linux') {
    return false;
  }
  const ttyPath = readTtyPath();
  return ttyPath !== undefined && /^\/dev\/tty\d+$/.test(ttyPath);
}

export function readLanguagePreference(
  filePath: string = getLanguagePreferenceFilePath(),
): string | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content || undefined;
  } catch {
    return undefined;
  }
}

export function renderLanguagePreference(options: {
  isVirtualConsole: boolean;
  preference?: string;
  filePath: string;
}): string {
  if (options.isVirtualConsole) {
    return `# Response Language
The user is on a Linux virtual console (TTY) that cannot display CJK or most other non-Latin characters. Respond in English only and keep prose to ASCII where practical, regardless of the language the user writes in or any saved language preference. Quote non-ASCII text only when it is required verbatim (e.g. file contents or identifiers).`;
  }
  if (!options.preference) {
    return '';
  }
  return `# Response Language
The user's global language preference (from \`${options.filePath}\`) is below. Follow it for all responses unless the user explicitly asks for another language in this conversation. Never translate code, commands, paths, identifiers, or quoted output.

<language_preference>
${options.preference}
</language_preference>`;
}

/**
 * Builds the system prompt section for the user's response language. The
 * preference file is re-read on every call so each session starts with its
 * current contents.
 */
export function getLanguagePreferencePrompt(): string {
  const filePath = getLanguagePreferenceFilePath();
  const isVirtualConsole = isLinuxVirtualConsole();
  return renderLanguagePreference({
    isVirtualConsole,
    preference: isVirtualConsole ? undefined : readLanguagePreference(filePath),
    filePath,
  });
}
