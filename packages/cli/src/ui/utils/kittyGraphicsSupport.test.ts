/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GRAPHICS_QUERY_ID,
  PLACEHOLDER_QUERY_ID,
  kittyGraphicsQueries,
  parseKittyGraphicsSupport,
} from './kittyGraphicsSupport.js';

const graphics = `\x1b_Gi=${GRAPHICS_QUERY_ID};OK\x1b\\`;
const feature = `\x1b_GU=1,i=${PLACEHOLDER_QUERY_ID},e=T;OK\x1b\\`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Kitty graphics capabilities', () => {
  it('requires a successful graphics query as well as placeholders', () => {
    expect(parseKittyGraphicsSupport(feature)).toEqual({
      graphics: false,
      placeholders: false,
    });
    expect(parseKittyGraphicsSupport(graphics + feature)).toEqual({
      graphics: true,
      placeholders: true,
    });
  });

  it('does not confuse keyboard support or basic graphics with placeholders', () => {
    expect(parseKittyGraphicsSupport('\x1b[?1u')).toEqual({
      graphics: false,
      placeholders: false,
    });
    expect(parseKittyGraphicsSupport(graphics)).toEqual({
      graphics: true,
      placeholders: false,
    });
  });

  it('does not accept an unrelated or unfinished reply', () => {
    expect(
      parseKittyGraphicsSupport(graphics + '\x1b_Gi=123,e=T,U=1;OK\x1b\\')
        .placeholders,
    ).toBe(false);
    expect(
      parseKittyGraphicsSupport(graphics + feature.slice(0, -1)).placeholders,
    ).toBe(false);
  });

  it.each([
    ['kitty(0.27.1)', false],
    ['kitty(0.28.0)', true],
    ['kitty(0.49.0)', true],
    ['Konsole 25.12', false],
    ['unknown', false],
  ])(
    'uses known Kitty versions only for legacy feature-query fallback: %s',
    (name, expected) => {
      expect(parseKittyGraphicsSupport(graphics, name).placeholders).toBe(
        expected,
      );
      expect(parseKittyGraphicsSupport('', name).placeholders).toBe(false);
    },
  );

  it('honors an explicit feature reply without U even for Kitty', () => {
    const reply = `\x1b_Gi=${PLACEHOLDER_QUERY_ID},e=T;OK\x1b\\`;
    expect(
      parseKittyGraphicsSupport(graphics + reply, 'kitty(0.50.0)').placeholders,
    ).toBe(false);
  });

  it('uses query actions without creating persistent images', () => {
    vi.stubEnv('TMUX', '');
    const query = kittyGraphicsQueries();
    expect(query).toContain(`i=${GRAPHICS_QUERY_ID},s=1,v=1,a=q,t=d,f=24;AAAA`);
    expect(query).toContain(`a=q,i=${PLACEHOLDER_QUERY_ID},e=T,U=1`);
    expect(query).not.toContain('a=T');
  });

  it('wraps the queries for tmux passthrough', () => {
    vi.stubEnv('TMUX', '/tmp/tmux');
    expect(kittyGraphicsQueries()).toContain('\x1bPtmux;\x1b\x1b_G');
  });
});
