/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
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
  KITTY_LOGO_ROWS,
  kittyCommand,
  kittyLogoColumns,
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
import { getCachedStringWidth } from '../utils/textUtils.js';

const IMAGE_ID = randomInt(1, 0xffffff);
const BESIDE_GAP = 2;
let uploaded = false;

interface CustomLogoProps {
  mode?: string;
  text?: string;
  image?: string;
  width: number;
  children?: (beside: boolean) => ReactNode;
  besideMinWidth?: number;
}

export function CustomLogo({
  mode,
  text,
  image,
  width,
  children,
  besideMinWidth,
}: CustomLogoProps) {
  const { stdout } = useStdout();
  const imageBox = useRef<DOMElement>(null);
  const placeholders =
    terminalCapabilityManager.supportsKittyUnicodePlaceholders();
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
        const size = validatePngLogo(data);

        return { data, size };
      } finally {
        closeSync(file);
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [mode, image, stdout.isTTY]);
  const columns = Math.max(
    1,
    Math.min(
      24,
      width,
      asset?.size
        ? kittyLogoColumns(asset.size, terminalCapabilityManager.getCellSize())
        : 24,
    ),
  );

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

  const below = children?.(false);
  const layout = (logo: ReactNode, logoWidth: number) => {
    const besideWidth = width - logoWidth - BESIDE_GAP;

    return besideMinWidth !== undefined && besideMinWidth <= besideWidth ? (
      <Box alignItems="flex-end">
        <Box width={logoWidth} flexShrink={0}>
          {logo}
        </Box>
        <Box flexDirection="column" marginLeft={BESIDE_GAP} width={besideWidth}>
          {children?.(true)}
        </Box>
      </Box>
    ) : (
      <>
        <Box marginBottom={1} width={Math.min(logoWidth, width)}>
          {logo}
        </Box>
        {below}
      </>
    );
  };

  if (mode === 'ascii' && text) {
    let safeText: string;
    try {
      safeText = validateAsciiLogo(text);
    } catch {
      return below;
    }

    return layout(
      <Text wrap="truncate-end" color={theme.text.primary}>
        {safeText}
      </Text>,
      Math.max(...safeText.split('\n').map(getCachedStringWidth)),
    );
  }

  if (mode !== 'kitty' || !asset) {
    return below;
  }

  if (asset.error) {
    return (
      <>
        <Text color={theme.status.warning}>Logo: {asset.error}</Text>
        {below}
      </>
    );
  }

  return layout(
    <Box ref={imageBox} height={KITTY_LOGO_ROWS}>
      <Text>{placeholders ? kittyPlaceholder(IMAGE_ID, columns) : marker}</Text>
    </Box>,
    columns,
  );
}
