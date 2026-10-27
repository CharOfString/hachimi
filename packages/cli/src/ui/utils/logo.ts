/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import stringWidth from 'string-width';
import { terminalPassthrough } from './kittyGraphicsSupport.js';

export async function readLogoFile(
  path: string,
  limit: number,
): Promise<Buffer> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);

  try {
    const stat = await file.stat();

    if (!stat.isFile() || stat.size > limit) {
      throw new Error(
        `Logo must be a regular file smaller than ${limit} bytes.`,
      );
    }

    const data = Buffer.alloc(limit + 1);
    let bytesRead = 0;

    while (bytesRead < data.length) {
      const result = await file.read(
        data,
        bytesRead,
        data.length - bytesRead,
        bytesRead,
      );

      if (result.bytesRead === 0) {
        break;
      }

      bytesRead += result.bytesRead;
    }

    if (bytesRead > limit) {
      throw new Error('Logo file is too large.');
    }

    return data.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

export function validateAsciiLogo(text: string): string {
  const normalized = text.replaceAll('\r\n', '\n').replace(/\n+$/, '');

  if (!normalized.trim()) {
    throw new Error('ASCII logo cannot be empty.');
  }

  for (const character of normalized) {
    const code = character.codePointAt(0)!;

    if ((code < 32 && code !== 10) || (code >= 127 && code <= 159)) {
      throw new Error('ASCII logo cannot contain terminal controls or tabs.');
    }
  }

  const lines = normalized.split('\n');

  if (lines.length > 20 || lines.some((line) => stringWidth(line) > 120)) {
    throw new Error('ASCII logo must fit within 120 columns and 20 lines.');
  }

  return normalized;
}

export const KITTY_LOGO_ROWS = 6;

const DEFAULT_CELL_RATIO = 2;

export function kittyLogoColumns(
  image: { width: number; height: number },
  cell?: { width: number; height: number },
): number {
  const cellRatio = cell ? cell.height / cell.width : DEFAULT_CELL_RATIO;
  return Math.max(
    1,
    Math.ceil((KITTY_LOGO_ROWS * cellRatio * image.width) / image.height),
  );
}

export function validatePngLogo(data: Buffer): {
  width: number;
  height: number;
} {
  if (
    data.length < 33 ||
    !data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    data.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw new Error('Kitty logo must be a PNG image.');
  }

  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);

  if (!width || !height || width * height > 16_000_000) {
    throw new Error('PNG logo must contain between 1 and 16 million pixels.');
  }

  return { width, height };
}

export function kittyCommand(payload: string): string {
  return terminalPassthrough(`\x1b_G${payload}\x1b\\`);
}

export function kittyUpload(
  data: Buffer,
  id: number,
  columns: number,
  placeholders = true,
): string {
  const encoded = data.toString('base64');
  const chunks: string[] = [];

  for (let offset = 0; offset < encoded.length; offset += 4096) {
    const more = offset + 4096 < encoded.length ? 1 : 0;
    const parameters =
      offset === 0
        ? `a=T,f=100,t=d,${placeholders ? 'U=1' : 'C=1,p=1'},q=2,i=${id},c=${columns},r=${KITTY_LOGO_ROWS},m=${more}`
        : `m=${more},q=2`;
    chunks.push(
      kittyCommand(`${parameters};${encoded.slice(offset, offset + 4096)}`),
    );
  }

  return chunks.join('');
}

const DIACRITICS = [
  0x0305, 0x030d, 0x030e, 0x0310, 0x0312, 0x033d, 0x033e, 0x033f, 0x0346,
  0x034a, 0x034b, 0x034c, 0x0350, 0x0351, 0x0352, 0x0357, 0x035b, 0x0363,
  0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369,
];

export function kittyPlaceholder(id: number, columns: number): string {
  const color = `\x1b[38;2;${(id >> 16) & 255};${(id >> 8) & 255};${id & 255}m`;

  return Array.from({ length: KITTY_LOGO_ROWS }, (_, row) => {
    const cells = Array.from({ length: columns }, (_, column) =>
      String.fromCodePoint(0x10eeee, DIACRITICS[row], DIACRITICS[column]),
    ).join('');

    return `${color}${cells}\x1b[39m`;
  }).join('\n');
}
