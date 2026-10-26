/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Static } from 'ink';
import { writeToStdout } from '@google/gemini-cli-core';
import { render } from '../../test-utils/render.js';
import { terminalCapabilityManager } from '../utils/terminalCapabilityManager.js';
import { renderKittyPlacements } from '../utils/kittyGraphicsOutput.js';
import { CustomLogo } from './CustomLogo.js';

vi.mock('@google/gemini-cli-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@google/gemini-cli-core')>()),
  writeToStdout: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CustomLogo', () => {
  it('renders nothing by default', async () => {
    const result = await render(<CustomLogo width={80} />);
    expect(result.lastFrame({ allowEmpty: true }).trim()).toBe('');
    result.unmount();
  });

  it('preserves ASCII indentation and hides it when switched off', async () => {
    const result = await render(
      <CustomLogo mode="ascii" text={'  /\\\n (oo)'} width={80} />,
    );
    expect(result.lastFrame({ allowEmpty: true })).toContain('  /\\');
    expect(result.lastFrame({ allowEmpty: true })).toContain(' (oo)');
    result.rerender(<CustomLogo mode="off" width={80} />);
    await result.waitUntilReady();
    expect(result.lastFrame({ allowEmpty: true })).not.toContain('(oo)');
    result.unmount();
  });

  it('does not emit graphics or placeholders when the image cannot be read', async () => {
    vi.spyOn(
      terminalCapabilityManager,
      'supportsKittyUnicodePlaceholders',
    ).mockReturnValue(false);
    vi.mocked(writeToStdout).mockClear();
    const result = await render(
      <CustomLogo mode="kitty" image="/missing.png" width={80} />,
    );
    expect(result.lastFrame()).toContain('Logo:');
    expect(result.lastFrame()).not.toContain(String.fromCodePoint(0x10eeee));
    expect(writeToStdout).not.toHaveBeenCalled();
    result.unmount();
  });

  it.each([true, false])(
    'renders graphics with Unicode placeholders=%s, resizes and deletes when disabled',
    async (placeholders) => {
      vi.spyOn(
        terminalCapabilityManager,
        'supportsKittyGraphics',
      ).mockReturnValue(true);
      vi.spyOn(
        terminalCapabilityManager,
        'supportsKittyUnicodePlaceholders',
      ).mockReturnValue(placeholders);
      const directory = await mkdtemp(
        path.join(os.tmpdir(), 'hachimi-image-test-'),
      );
      const filename = path.join(directory, 'logo.png');
      await writeFile(
        filename,
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=',
          'base64',
        ),
      );
      vi.mocked(writeToStdout).mockClear();
      const staticResult = await render(
        <Static items={[filename]}>
          {(image) => (
            <CustomLogo key={image} mode="kitty" image={image} width={80} />
          )}
        </Static>,
      );

      expect(staticResult.lastFrame()).toContain(
        placeholders
          ? String.fromCodePoint(0x10eeee)
          : String.fromCodePoint(0xf0000),
      );
      staticResult.unmount();
      const result = await render(
        <CustomLogo mode="kitty" image={filename} width={80} />,
      );

      try {
        if (placeholders) {
          expect(writeToStdout).toHaveBeenCalledWith(
            expect.stringContaining('a=T,f=100,t=d,U=1,q=2'),
          );
          expect(result.lastFrameRaw()).toContain(
            String.fromCodePoint(0x10eeee),
          );
          expect(result.lastFrameRaw()).toContain('\x1b[38;2;');
        } else {
          const output = renderKittyPlacements(result.lastFrameRaw());
          expect(output).toContain('a=T,f=100,t=d,C=1,p=1,q=2');
          expect(output).not.toContain(String.fromCodePoint(0x10eeee));
          expect(output).not.toMatch(/[\u{f0000}-\u{f0fff}]/u);
        }
        result.rerender(
          <CustomLogo mode="kitty" image={filename} width={10} />,
        );
        await result.waitUntilReady();
        if (placeholders) {
          expect(writeToStdout).toHaveBeenLastCalledWith(
            expect.stringContaining('c=10,r=6'),
          );
        } else {
          expect(renderKittyPlacements(result.lastFrameRaw())).toContain(
            'c=10,r=6',
          );
        }
        result.rerender(<CustomLogo mode="off" width={80} />);
        await result.waitUntilReady();
        expect(writeToStdout).toHaveBeenLastCalledWith(
          expect.stringContaining('a=d,d=I,'),
        );
        expect(result.lastFrame({ allowEmpty: true })).not.toContain(
          String.fromCodePoint(0x10eeee),
        );
      } finally {
        result.unmount();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
});
