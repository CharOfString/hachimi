/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { PassThrough } from 'node:stream';
import { act, createElement } from 'react';
import { render, Text } from 'ink';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerKittyPlacement,
  removeKittyPlacements,
  renderKittyPlacements,
  withKittyGraphics,
} from './kittyGraphicsOutput.js';

afterEach(() => {
  vi.unstubAllEnvs();
  removeKittyPlacements(123);
});

describe('Kitty graphics without Unicode placeholders', () => {
  it('places the image at the rendered cell and preserves its text width', () => {
    vi.stubEnv('TMUX', '');
    const marker = registerKittyPlacement(Buffer.from('image'), 123, 24);
    const rendered = renderKittyPlacements(`before ${marker} after`);
    expect(rendered).toContain('a=T,f=100,t=d,C=1,p=1,q=2,i=123,c=24,r=6');
    expect(rendered).toContain('a=d,d=i,i=123,q=2');
    expect(rendered).not.toContain('U=1');
    expect(rendered).not.toContain(marker);
    expect(rendered.endsWith('  after')).toBe(true);
    expect(rendered.startsWith('before ')).toBe(true);
  });

  it('converts the actual Ink output before it reaches the terminal', async () => {
    vi.stubEnv('TMUX', '');
    const stream = Object.assign(new PassThrough(), {
      isTTY: true,
      columns: 80,
      rows: 24,
      getColorDepth: () => 24,
    });
    let output = '';
    stream.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    const marker = registerKittyPlacement(Buffer.from('image'), 123, 24);
    let instance: ReturnType<typeof render> | undefined;

    await act(async () => {
      instance = render(createElement(Text, null, marker), {
        stdout: withKittyGraphics(stream as unknown as NodeJS.WriteStream),
        stdin: new PassThrough() as unknown as NodeJS.ReadStream,
        exitOnCtrlC: false,
        patchConsole: false,
      });
    });

    try {
      await vi.waitFor(() => expect(output).toContain('a=T,f=100,t=d,C=1,p=1'));
      expect(output).not.toContain(marker);
      expect(output).not.toContain(String.fromCodePoint(0x10eeee));
    } finally {
      await act(async () => {
        instance?.unmount();
        instance?.cleanup();
      });
    }
  });

  it('does not draw an expired image on a later redraw', () => {
    const marker = registerKittyPlacement(Buffer.from('image'), 123, 24);
    removeKittyPlacements(123);
    expect(renderKittyPlacements(marker)).toBe(' ');
  });

  it('preserves stream write callbacks, return values and ordinary output', () => {
    const write = vi.fn().mockReturnValue(false);
    const stdout = { write, isTTY: true } as unknown as NodeJS.WriteStream;
    const wrapped = withKittyGraphics(stdout);
    const callback = vi.fn();
    expect(wrapped.isTTY).toBe(true);
    expect(wrapped.write('hello', callback)).toBe(false);
    expect(write).toHaveBeenCalledWith('hello', callback);
    const marker = registerKittyPlacement(Buffer.from('image'), 123, 10);
    wrapped.write(marker);
    expect(write).toHaveBeenLastCalledWith(expect.stringContaining('c=10,r=6'));
  });
});
