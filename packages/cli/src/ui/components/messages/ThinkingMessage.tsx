/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { ThoughtSummary } from '@google/gemini-cli-core';
import { theme } from '../../semantic-colors.js';
import { normalizeEscapedNewlines } from '../../utils/textUtils.js';

interface ThinkingMessageProps {
  thought: ThoughtSummary;
  terminalWidth: number;
  isFirstThinking?: boolean;
}

const THINKING_LEFT_PADDING = 1;

function normalizeThoughtLines(thought: ThoughtSummary): {
  heading?: string;
  body: string[];
} {
  const subject = normalizeEscapedNewlines(thought.subject).trim();
  const description = normalizeEscapedNewlines(thought.description).trim();

  const isNoise = (text: string) => {
    const trimmed = text.trim();
    return !trimmed || /^\.+$/.test(trimmed);
  };

  const body = description
    ? description
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => !isNoise(line))
    : [];

  return subject && !isNoise(subject) ? { heading: subject, body } : { body };
}

/**
 * Renders a model's thought as a distinct bubble.
 * Leverages Ink layout for wrapping and borders.
 */
export const ThinkingMessage: React.FC<ThinkingMessageProps> = ({
  thought,
  terminalWidth,
  isFirstThinking,
}) => {
  const { heading, body } = useMemo(
    () => normalizeThoughtLines(thought),
    [thought],
  );

  if (!heading && body.length === 0) {
    return null;
  }

  return (
    <Box width={terminalWidth} flexDirection="column">
      {isFirstThinking && (
        <Text color={theme.text.primary} italic>
          {' '}
          Thinking...{' '}
        </Text>
      )}

      <Box
        marginLeft={THINKING_LEFT_PADDING}
        paddingLeft={1}
        borderStyle="single"
        borderLeft={true}
        borderRight={false}
        borderTop={false}
        borderBottom={false}
        borderColor={theme.text.secondary}
        flexDirection="column"
      >
        <Text> </Text>
        {heading && (
          <Text color={theme.text.primary} bold italic>
            {heading}
          </Text>
        )}
        {body.map((line, index) => (
          <Text key={`body-line-${index}`} color={theme.text.secondary} italic>
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
};
