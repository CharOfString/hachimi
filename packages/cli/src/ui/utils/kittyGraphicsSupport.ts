/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

export const GRAPHICS_QUERY_ID = '2147483000';
export const PLACEHOLDER_QUERY_ID = '2147483001';

export function terminalPassthrough(sequence: string): string {
  if (process.env['TMUX']) {
    return `\x1bPtmux;${sequence.replaceAll('\x1b', '\x1b\x1b')}\x1b\\`;
  }

  return sequence;
}

export function kittyGraphicsQueries(): string {
  return terminalPassthrough(
    `\x1b_Gi=${GRAPHICS_QUERY_ID},s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\` +
      `\x1b_Ga=q,i=${PLACEHOLDER_QUERY_ID},e=T,U=1\x1b\\`,
  );
}

export function parseKittyGraphicsSupport(
  buffer: string,
  terminalName?: string,
) {
  let graphics = false;
  let placeholders = false;
  let featuresReported = false;

  for (const fragment of buffer.split('\x1b_G').slice(1)) {
    const end = fragment.indexOf('\x1b\\');

    if (end < 0) {
      continue;
    }

    const [parameters, status] = fragment.slice(0, end).split(';');
    const fields = new Map(
      parameters.split(',').map((field) => {
        const [key, value] = field.split('=');

        return [key, value];
      }),
    );

    if (fields.get('i') === GRAPHICS_QUERY_ID && status === 'OK') {
      graphics = true;
    }

    if (
      fields.get('i') === PLACEHOLDER_QUERY_ID &&
      status === 'OK' &&
      fields.has('e')
    ) {
      featuresReported = true;
      placeholders = fields.get('e') === 'T' && fields.get('U') === '1';
    }
  }

  if (graphics && !featuresReported) {
    const version = terminalName?.match(/^kitty\((\d+)\.(\d+)(?:\.\d+)?\)/i);

    if (version) {
      placeholders = Number(version[1]) > 0 || Number(version[2]) >= 28;
    }
  }

  return { graphics, placeholders: graphics && placeholders };
}
