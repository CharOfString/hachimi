/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import { theme } from '../semantic-colors.js';
import {
  getContextTokenLimit,
  getContextUsagePercentage,
} from '../utils/contextUsage.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { MIN_TERMINAL_WIDTH_FOR_FULL_LABEL } from '../constants.js';
import { interpolateColor } from '../themes/color-utils.js';

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatTokens = (count: number) => compact.format(count).toLowerCase();

export function getContextUsageColor(percentage: number): string {
  const used = Math.min(Math.max(percentage, 0), 1);
  return used < 0.5
    ? interpolateColor(theme.status.success, theme.status.warning, used * 2)
    : interpolateColor(
        theme.status.warning,
        theme.status.error,
        (used - 0.5) * 2,
      );
}

export const ContextUsageDisplay = ({
  promptTokenCount,
  model,
  terminalWidth,
  showTokens = false,
}: {
  promptTokenCount: number;
  model: string | undefined;
  terminalWidth: number;
  showTokens?: boolean;
}) => {
  const account = useConfig().getContentGeneratorConfig()?.providerAccount;
  const percentage = getContextUsagePercentage(
    promptTokenCount,
    model,
    account,
  );
  const percentageUsed = (percentage * 100).toFixed(0);

  const textColor = getContextUsageColor(percentage);

  if (showTokens) {
    const limit = getContextTokenLimit(model, account);
    return (
      <Text color={textColor}>
        {`${formatTokens(promptTokenCount)}/${formatTokens(limit)} · ${percentageUsed}%`}
      </Text>
    );
  }

  const label =
    terminalWidth < MIN_TERMINAL_WIDTH_FOR_FULL_LABEL ? '%' : '% used';

  return (
    <Text color={textColor}>
      {percentageUsed}
      {label}
    </Text>
  );
};
