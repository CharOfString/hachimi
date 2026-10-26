/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { logoCommand } from './logoCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { SettingScope } from '../../config/settings.js';

let directory: string | undefined;

afterEach(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

describe('/logo', () => {
  it('shows usage without modifying settings', async () => {
    const context = createMockCommandContext();
    expect(await logoCommand.action!(context, '')).toMatchObject({
      messageType: 'info',
      content: expect.stringContaining('/logo kitty'),
    });
    expect(context.services.settings.setValue).not.toHaveBeenCalled();
  });

  it('turns the logo off', async () => {
    const context = createMockCommandContext();
    await logoCommand.action!(context, 'off');
    expect(context.services.settings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'ui.logo',
      { mode: 'off' },
    );
  });

  it('loads an artwork file with spaces and saves its content', async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'hachimi-logo-test-'));
    const filename = path.join(directory, 'my logo.txt');
    await writeFile(filename, ' /\\\n(oo)\n');
    const context = createMockCommandContext();
    expect(
      await logoCommand.action!(context, `ascii "${filename}"`),
    ).toMatchObject({ messageType: 'info' });
    expect(context.services.settings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'ui.logo',
      { mode: 'ascii', text: ' /\\\n(oo)' },
    );
  });

  it('does not overwrite the logo if the image is invalid', async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'hachimi-logo-test-'));
    const filename = path.join(directory, 'bad.png');
    await writeFile(filename, 'invalid');
    const context = createMockCommandContext();
    expect(
      await logoCommand.action!(context, `kitty ${filename}`),
    ).toMatchObject({ messageType: 'error' });
    expect(context.services.settings.setValue).not.toHaveBeenCalled();
  });
});
