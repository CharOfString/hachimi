/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Rewrites CNL/CPL (`CSI n E` / `CSI n F`) as CR + CUD/CUU.
 *
 * Ink's incremental renderer moves between lines with CNL, but Konsole-derived
 * emulators such as gxde-terminal and deepin-terminal ignore it, so every
 * redraw lands one row off and leaves ghost lines behind. CR + CUD/CUU has the
 * same meaning and is supported everywhere.
 */
export function expandCursorLineMoves(output: string): string {
  return output.replace(
    // eslint-disable-next-line no-control-regex
    /\x1b\[(\d*)([EF])/g,
    (_, count: string, final: string) =>
      `\r\x1b[${count}${final === 'E' ? 'B' : 'A'}`,
  );
}
