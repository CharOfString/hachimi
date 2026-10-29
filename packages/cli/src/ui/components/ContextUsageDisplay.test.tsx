/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../test-utils/render.js';
import {
  ContextUsageDisplay,
  getContextUsageColor,
} from './ContextUsageDisplay.js';
import { theme } from '../semantic-colors.js';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@google/gemini-cli-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@google/gemini-cli-core')>();
  return {
    ...actual,
    tokenLimit: () => 10000,
  };
});

describe('ContextUsageDisplay', () => {
  it('renders correct percentage used', async () => {
    const { lastFrame, unmount } = await renderWithProviders(
      <ContextUsageDisplay
        promptTokenCount={5000}
        model="gemini-pro"
        terminalWidth={120}
      />,
    );
    const output = lastFrame();
    expect(output).toContain('50% used');
    unmount();
  });

  it('renders correctly when usage is 0%', async () => {
    const { lastFrame, unmount } = await renderWithProviders(
      <ContextUsageDisplay
        promptTokenCount={0}
        model="gemini-pro"
        terminalWidth={120}
      />,
    );
    const output = lastFrame();
    expect(output).toContain('0% used');
    unmount();
  });

  it('renders abbreviated label when terminal width is small', async () => {
    const { lastFrame, unmount } = await renderWithProviders(
      <ContextUsageDisplay
        promptTokenCount={2000}
        model="gemini-pro"
        terminalWidth={80}
      />,
      { width: 80 },
    );
    const output = lastFrame();
    expect(output).toContain('20%');
    expect(output).not.toContain('context used');
    unmount();
  });

  it('renders 80% correctly', async () => {
    const { lastFrame, unmount } = await renderWithProviders(
      <ContextUsageDisplay
        promptTokenCount={8000}
        model="gemini-pro"
        terminalWidth={120}
      />,
    );
    const output = lastFrame();
    expect(output).toContain('80% used');
    unmount();
  });

  it('renders 100% when full', async () => {
    const { lastFrame, unmount } = await renderWithProviders(
      <ContextUsageDisplay
        promptTokenCount={10000}
        model="gemini-pro"
        terminalWidth={120}
      />,
    );
    const output = lastFrame();
    expect(output).toContain('100% used');
    unmount();
  });

  it('renders tokens, limit and percentage when showTokens is set', async () => {
    const { lastFrame, unmount } = await renderWithProviders(
      <ContextUsageDisplay
        promptTokenCount={2500}
        model="gemini-pro"
        terminalWidth={120}
        showTokens
      />,
    );
    expect(lastFrame()).toContain('2.5k/10k · 25%');
    unmount();
  });

  describe('getContextUsageColor', () => {
    it('is green when the context is empty', () => {
      expect(getContextUsageColor(0)).toBe(theme.status.success);
    });

    it('is yellow at half usage', () => {
      expect(getContextUsageColor(0.5)).toBe(theme.status.warning);
    });

    it('is red when the context is full or over', () => {
      expect(getContextUsageColor(1)).toBe(theme.status.error);
      expect(getContextUsageColor(1.2)).toBe(theme.status.error);
    });

    it('blends between the stops', () => {
      const color = getContextUsageColor(0.75);
      expect(color).not.toBe(theme.status.warning);
      expect(color).not.toBe(theme.status.error);
    });
  });
});
