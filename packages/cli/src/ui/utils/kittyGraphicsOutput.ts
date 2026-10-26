/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { kittyCommand, kittyUpload } from './logo.js';

const placements = new Map<
  string,
  { id: number; data: Buffer; columns: number }
>();
let nextMarker = 0;

export function registerKittyPlacement(
  data: Buffer,
  id: number,
  columns: number,
): string {
  const marker = String.fromCodePoint(0xf0000 + (nextMarker++ % 4096));
  placements.set(marker, { id, data, columns });

  if (placements.size > 8) {
    const oldest = placements.keys().next().value;

    if (oldest !== undefined) {
      placements.delete(oldest);
    }
  }

  return marker;
}

export function removeKittyPlacements(id: number): void {
  for (const [marker, placement] of placements) {
    if (placement.id === id) {
      placements.delete(marker);
    }
  }
}

export function renderKittyPlacements(output: string): string {
  return output.replace(/[\u{f0000}-\u{f0fff}]/gu, (marker) => {
    const placement = placements.get(marker);

    if (!placement) {
      return ' ';
    }

    return (
      kittyCommand(`a=d,d=i,i=${placement.id},q=2`) +
      kittyUpload(placement.data, placement.id, placement.columns, false) +
      ' '
    );
  });
}

function hasStreamProperty(
  stream: NodeJS.WriteStream,
  key: PropertyKey,
): key is keyof NodeJS.WriteStream {
  return key in stream;
}

export function withKittyGraphics(
  stdout: NodeJS.WriteStream,
): NodeJS.WriteStream {
  return new Proxy(stdout, {
    get(target, property) {
      if (property === 'write') {
        return (...args: Parameters<NodeJS.WriteStream['write']>) => {
          const [chunk] = args;
          const text =
            typeof chunk === 'string'
              ? chunk
              : Buffer.from(chunk).toString('utf8');

          args[0] = renderKittyPlacements(text);

          return target.write(...args);
        };
      }

      if (!hasStreamProperty(target, property)) {
        return undefined;
      }

      const value: unknown = target[property];

      return typeof value === 'function'
        ? (value.bind(target) as unknown)
        : value;
    },
  });
}
