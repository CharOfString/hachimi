/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { Static } from 'ink';
import { writeToStdout } from '@google/gemini-cli-core';
import { render } from '../../test-utils/render.js';
import { CustomLogo } from './CustomLogo.js';

vi.mock('@google/gemini-cli-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@google/gemini-cli-core')>()),
  writeToStdout: vi.fn(),
}));

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

  it('uploads a PNG, renders placeholders, resizes and deletes when disabled', async () => {
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

    expect(staticResult.lastFrame()).toContain(String.fromCodePoint(0x10eeee));
    staticResult.unmount();
    const result = await render(
      <CustomLogo mode="kitty" image={filename} width={80} />,
    );

    try {
      expect(writeToStdout).toHaveBeenCalledWith(
        expect.stringContaining('a=T,f=100,t=d,U=1,q=2'),
      );
      expect(result.lastFrameRaw()).toContain(String.fromCodePoint(0x10eeee));
      expect(result.lastFrameRaw()).toContain('\x1b[38;2;');
      result.rerender(<CustomLogo mode="kitty" image={filename} width={10} />);
      await result.waitUntilReady();
      expect(writeToStdout).toHaveBeenLastCalledWith(
        expect.stringContaining('c=10,r=6'),
      );
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
  });
});
