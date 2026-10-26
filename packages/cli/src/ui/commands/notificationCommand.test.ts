/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { SettingScope } from '../../config/settings.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { notificationCommand } from './notificationCommand.js';

describe('/notification', () => {
  it('reports notifications as enabled by default', async () => {
    const context = createMockCommandContext();

    expect(await notificationCommand.action!(context, '')).toMatchObject({
      messageType: 'info',
      content: expect.stringContaining('Notifications: on'),
    });
    expect(context.services.settings.setValue).not.toHaveBeenCalled();
  });

  it.each([
    ['on', true],
    ['off', false],
  ])('persists %s at user scope', async (mode, enabled) => {
    const context = createMockCommandContext();

    expect(await notificationCommand.action!(context, mode)).toMatchObject({
      messageType: 'info',
    });
    expect(context.services.settings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'general.enableNotifications',
      enabled,
    );
  });

  it('reports an explicitly disabled setting', async () => {
    const context = createMockCommandContext({
      services: {
        settings: {
          merged: { general: { enableNotifications: false } },
        },
      },
    });

    expect(await notificationCommand.action!(context, '')).toMatchObject({
      content: expect.stringContaining('Notifications: off'),
    });
  });

  it('rejects unknown arguments without changing settings', async () => {
    const context = createMockCommandContext();

    expect(
      await notificationCommand.action!(context, 'sometimes'),
    ).toMatchObject({
      messageType: 'error',
      content: 'Usage: /notification [on|off]',
    });
    expect(context.services.settings.setValue).not.toHaveBeenCalled();
  });

  it('reports settings write failures', async () => {
    const context = createMockCommandContext();
    vi.mocked(context.services.settings.setValue).mockImplementation(() => {
      throw new Error('cannot save');
    });

    expect(await notificationCommand.action!(context, 'off')).toMatchObject({
      messageType: 'error',
      content: 'cannot save',
    });
  });
});
