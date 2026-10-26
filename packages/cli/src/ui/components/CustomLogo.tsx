/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import { Box, Text, useStdout, type DOMElement } from 'ink';
import {
  openSync,
  fstatSync,
  readFileSync,
  closeSync,
  constants,
} from 'node:fs';
import { randomInt } from 'node:crypto';
import { writeToStdout } from '@google/gemini-cli-core';
import {
  kittyCommand,
  kittyPlaceholder,
  kittyUpload,
  validateAsciiLogo,
  validatePngLogo,
} from '../utils/logo.js';
import { terminalCapabilityManager } from '../utils/terminalCapabilityManager.js';
import {
  registerKittyPlacement,
  removeKittyPlacements,
} from '../utils/kittyGraphicsOutput.js';
import { theme } from '../semantic-colors.js';

const IMAGE_ID = randomInt(1, 0xffffff);
let uploaded = false;

interface CustomLogoProps {
  mode?: string;
  text?: string;
  image?: string;
  width: number;
}

export function CustomLogo({ mode, text, image, width }: CustomLogoProps) {
  const { stdout } = useStdout();
  const imageBox = useRef<DOMElement>(null);
  const placeholders =
    terminalCapabilityManager.supportsKittyUnicodePlaceholders();
  const columns = Math.max(1, Math.min(24, width));
  const asset = useMemo(() => {
    if (mode !== 'kitty' || !image || !stdout.isTTY) {
      return undefined;
    }

    try {
      const file = openSync(image, constants.O_RDONLY | constants.O_NONBLOCK);

      try {
        const stat = fstatSync(file);

        if (!stat.isFile() || stat.size > 2_097_152) {
          throw new Error('Logo must be a PNG file smaller than 2 MiB.');
        }

        const data = readFileSync(file);
        validatePngLogo(data);

        return { data };
      } finally {
        closeSync(file);
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [mode, image, stdout.isTTY]);

  const marker = useMemo(() => {
    if (!asset?.data || placeholders) {
      return undefined;
    }

    return registerKittyPlacement(asset.data, IMAGE_ID, columns);
  }, [asset, placeholders, columns]);

  useLayoutEffect(() => {
    if (asset?.data) {
      if (placeholders) {
        writeToStdout(kittyUpload(asset.data, IMAGE_ID, columns));
      }

      uploaded = true;
    } else if (uploaded) {
      removeKittyPlacements(IMAGE_ID);
      writeToStdout(kittyCommand(`a=d,d=I,i=${IMAGE_ID},q=2`));
      uploaded = false;
    }
  }, [asset, columns, placeholders]);

  useLayoutEffect(() => {
    if (!marker) {
      return;
    }

    let ancestor: DOMElement | undefined = imageBox.current ?? undefined;

    while (ancestor) {
      if (ancestor.internal_static) {
        return;
      }

      ancestor = ancestor.parentNode;
    }

    return () => {
      writeToStdout(kittyCommand(`a=d,d=i,i=${IMAGE_ID},q=2`));
    };
  }, [marker]);

  if (mode === 'ascii' && text) {
    try {
      const safeText = validateAsciiLogo(text);

      return (
        <Box marginBottom={1} width={width}>
          <Text wrap="truncate-end" color={theme.text.primary}>
            {safeText}
          </Text>
        </Box>
      );
    } catch {
      return null;
    }
  }

  if (mode !== 'kitty' || !asset) {
    return null;
  }

  if (asset.error) {
    return <Text color={theme.status.warning}>Logo: {asset.error}</Text>;
  }

  return (
    <Box ref={imageBox} width={columns} height={6} marginBottom={1}>
      <Text>{placeholders ? kittyPlaceholder(IMAGE_ID, columns) : marker}</Text>
    </Box>
  );
}
