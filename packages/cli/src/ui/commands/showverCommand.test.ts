/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { showverCommand } from './showverCommand.js';
import { SettingScope } from '../../config/settings.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('showverCommand', () => {
  it('is listed with on/off subcommands', () => {
    expect(showverCommand.name).toBe('showver');
    expect(showverCommand.hidden).toBeFalsy();
    expect(showverCommand.subCommands?.map((c) => c.name)).toEqual([
      'on',
      'off',
    ]);
  });

  it('/showver on subcommand saves the setting', async () => {
    const context = createMockCommandContext();
    vi.spyOn(context.services.settings, 'setValue');

    await showverCommand.subCommands![0].action!(context, '');

    expect(context.services.settings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'ui.showVersionHeader',
      true,
    );
  });

  it.each([
    ['on', true],
    ['off', false],
  ])('/showver %s saves the setting', async (mode, enabled) => {
    const context = createMockCommandContext();
    vi.spyOn(context.services.settings, 'setValue');

    const result = await showverCommand.action!(context, mode);

    expect(context.services.settings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'ui.showVersionHeader',
      enabled,
    );
    expect(result).toMatchObject({ type: 'message', messageType: 'info' });
  });

  it('reports the current state without arguments', async () => {
    const context = createMockCommandContext({
      services: {
        settings: { merged: { ui: { showVersionHeader: true } } },
      },
    });

    const result = await showverCommand.action!(context, '');

    expect(result).toMatchObject({
      type: 'message',
      messageType: 'info',
      content: expect.stringContaining('Pinned version header: on.'),
    });
  });

  it('rejects unknown arguments', async () => {
    const context = createMockCommandContext();

    const result = await showverCommand.action!(context, 'maybe');

    expect(result).toMatchObject({ type: 'message', messageType: 'error' });
  });
});
