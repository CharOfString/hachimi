/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  kittyPlaceholder,
  kittyUpload,
  kittyCommand,
  validateAsciiLogo,
  validatePngLogo,
} from './logo.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('logo data', () => {
  it('preserves indentation and normalizes text-file newlines', () => {
    expect(validateAsciiLogo('  /\\\r\n (oo)\r\n')).toBe('  /\\\n (oo)');
  });

  it.each(['\x1b[2J', '\x07', '\t', '', 'x'.repeat(121), 'x\n'.repeat(21)])(
    'rejects invalid artwork %j',
    (text) => {
      expect(() => validateAsciiLogo(text)).toThrow();
    },
  );

  it('rejects non-PNG input and unreasonable image dimensions', () => {
    expect(() => validatePngLogo(Buffer.from('not png'))).toThrow('PNG');
    const data = Buffer.alloc(33);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data);
    data.write('IHDR', 12);
    data.writeUInt32BE(100000, 16);
    data.writeUInt32BE(100000, 20);
    expect(() => validatePngLogo(data)).toThrow('pixels');
  });

  it('chunks the complete PNG payload into quiet virtual placements', () => {
    vi.stubEnv('TMUX', '');
    const data = Buffer.alloc(9000, 42);
    const output = kittyUpload(data, 123, 24);
    const chunks = output
      .split('\x1b_G')
      .slice(1)
      .map((chunk) => {
        const [parameters, data] = chunk.slice(0, -2).split(';');

        return ['', parameters, data];
      });
    expect(chunks).toHaveLength(3);
    expect(chunks[0][1]).toContain('a=T,f=100,t=d,U=1,q=2,i=123,c=24,r=6,m=1');
    expect(chunks.at(-1)![1]).toContain('m=0');
    expect(chunks.every((chunk) => chunk[2].length <= 4096)).toBe(true);
    expect(
      Buffer.from(chunks.map((chunk) => chunk[2]).join(''), 'base64'),
    ).toEqual(data);
  });

  it('encodes exact cell coordinates and the image ID', () => {
    const rows = kittyPlaceholder(0x123456, 3).split('\n');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toContain('\x1b[38;2;18;52;86m');
    expect(rows[1]).toContain(String.fromCodePoint(0x10eeee, 0x030d, 0x030e));
  });

  it('escapes graphics commands for tmux passthrough', () => {
    vi.stubEnv('TMUX', '/tmp/tmux');
    expect(kittyCommand('a=d')).toBe('\x1bPtmux;\x1b\x1b_Ga=d\x1b\x1b\\\x1b\\');
  });
});
