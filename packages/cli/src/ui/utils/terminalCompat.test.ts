/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { expandCursorLineMoves } from './terminalCompat.js';

describe('expandCursorLineMoves', () => {
  it('rewrites CNL and CPL as carriage return plus vertical moves', () => {
    expect(expandCursorLineMoves('a\x1b[Eb\x1b[3Ec\x1b[2F')).toBe(
      'a\r\x1b[Bb\r\x1b[3Bc\r\x1b[2A',
    );
  });

  it('leaves other sequences untouched', () => {
    const output = '\x1b[?2026h\x1b[1;1H\x1b[2K\x1b[4B\x1b[38;2;1;2;3mE';
    expect(expandCursorLineMoves(output)).toBe(output);
  });
});
