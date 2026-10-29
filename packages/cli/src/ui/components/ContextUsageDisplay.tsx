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
import { useSettings } from '../contexts/SettingsContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import {
  MIN_TERMINAL_WIDTH_FOR_FULL_LABEL,
  DEFAULT_COMPRESSION_THRESHOLD,
} from '../constants.js';

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatTokens = (count: number) => compact.format(count).toLowerCase();

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
  const settings = useSettings();
  const account = useConfig().getContentGeneratorConfig()?.providerAccount;
  const percentage = getContextUsagePercentage(
    promptTokenCount,
    model,
    account,
  );
  const percentageUsed = (percentage * 100).toFixed(0);

  const threshold =
    settings.merged.model?.compressionThreshold ??
    DEFAULT_COMPRESSION_THRESHOLD;

  let textColor = theme.text.secondary;
  if (percentage >= 1.0) {
    textColor = theme.status.error;
  } else if (percentage >= threshold) {
    textColor = theme.status.warning;
  }

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
