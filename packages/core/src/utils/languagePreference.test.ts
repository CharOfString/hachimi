/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.unmock('./languagePreference.js');

const { mockHomedir } = vi.hoisted(() => ({ mockHomedir: vi.fn() }));
vi.mock('./paths.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./paths.js')>()),
  homedir: mockHomedir,
}));

import {
  LANGUAGE_PREFERENCE_FILENAME,
  getLanguagePreferenceFilePath,
  getLanguagePreferencePrompt,
  isLinuxVirtualConsole,
  readLanguagePreference,
  renderLanguagePreference,
} from './languagePreference.js';

describe('isLinuxVirtualConsole', () => {
  const noTty = () => undefined;

  it('detects TERM=linux on any platform', () => {
    expect(isLinuxVirtualConsole({ TERM: 'linux' }, 'darwin', noTty)).toBe(
      true,
    );
  });

  it('detects stdio attached to /dev/ttyN on Linux', () => {
    expect(
      isLinuxVirtualConsole({ TERM: 'xterm' }, 'linux', () => '/dev/tty3'),
    ).toBe(true);
  });

  it('ignores pseudo-terminals and non-Linux tty paths', () => {
    expect(
      isLinuxVirtualConsole(
        { TERM: 'xterm-256color' },
        'linux',
        () => '/dev/pts/2',
      ),
    ).toBe(false);
    expect(
      isLinuxVirtualConsole({ TERM: 'xterm' }, 'darwin', () => '/dev/tty3'),
    ).toBe(false);
    expect(isLinuxVirtualConsole({}, 'linux', noTty)).toBe(false);
  });
});

describe('renderLanguagePreference', () => {
  const filePath = '/home/u/.gemini/LANGUAGE_PREFERENCE.md';

  it('enforces English on the virtual console even with a preference', () => {
    const prompt = renderLanguagePreference({
      isVirtualConsole: true,
      preference: '请用简体中文回答',
      filePath,
    });
    expect(prompt).toContain('Respond in English only');
    expect(prompt).not.toContain('简体中文');
  });

  it('includes the saved preference outside the console', () => {
    const prompt = renderLanguagePreference({
      isVirtualConsole: false,
      preference: '请用简体中文回答',
      filePath,
    });
    expect(prompt).toContain(filePath);
    expect(prompt).toContain(
      '<language_preference>\n请用简体中文回答\n</language_preference>',
    );
  });

  it('renders nothing without a preference outside the console', () => {
    expect(
      renderLanguagePreference({ isVirtualConsole: false, filePath }),
    ).toBe('');
  });
});

describe('global language preference file', () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lang-pref-'));
    mockHomedir.mockReturnValue(tempHome);
    vi.stubEnv('TERM', 'xterm-256color');
  });

  afterEach(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  const writePreference = (content: string) => {
    const filePath = getLanguagePreferenceFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  };

  it('lives in the global config directory', () => {
    expect(getLanguagePreferenceFilePath()).toBe(
      path.join(tempHome, '.gemini', LANGUAGE_PREFERENCE_FILENAME),
    );
  });

  it('reads trimmed content and treats missing or blank files as unset', () => {
    expect(readLanguagePreference()).toBeUndefined();
    writePreference('  \n');
    expect(readLanguagePreference()).toBeUndefined();
    writePreference('\nReply in Japanese.\n');
    expect(readLanguagePreference()).toBe('Reply in Japanese.');
  });

  it('builds the prompt from the current file contents', () => {
    expect(getLanguagePreferencePrompt()).toBe('');
    writePreference('Reply in Japanese.');
    expect(getLanguagePreferencePrompt()).toContain('Reply in Japanese.');
  });

  it('builds the English-only prompt under TERM=linux', () => {
    writePreference('Reply in Japanese.');
    vi.stubEnv('TERM', 'linux');
    const prompt = getLanguagePreferencePrompt();
    expect(prompt).toContain('Respond in English only');
    expect(prompt).not.toContain('Japanese');
  });
});
