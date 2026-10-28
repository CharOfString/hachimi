/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LoadedSettings } from '../../config/settings.js';

export type InlineThinkingMode = 'off' | 'collapsed' | 'full';

export function getInlineThinkingMode(
  settings: LoadedSettings,
): InlineThinkingMode {
  return settings.merged.ui?.inlineThinkingMode ?? 'collapsed';
}
