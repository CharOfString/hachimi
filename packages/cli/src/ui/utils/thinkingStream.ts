/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseThought, type ThoughtSummary } from '@google/gemini-cli-core';

/** The raw text of a thought event, rebuilt for events without it. */
export function getThoughtText(thought: ThoughtSummary): string {
  if (thought.text !== undefined) {
    return thought.text;
  }
  return thought.subject
    ? `**${thought.subject}**\n\n${thought.description}`
    : thought.description;
}

/** Gemini thought summaries open each new thought with a `**Subject**`. */
export function isThoughtHeading(text: string): boolean {
  return text.trimStart().startsWith('**');
}

/**
 * Shapes accumulated thought text for display: Gemini summaries keep their
 * subject, streamed provider reasoning is shown as plain description text.
 */
export function toThoughtSummary(text: string): ThoughtSummary {
  return isThoughtHeading(text)
    ? parseThought(text)
    : { subject: '', description: text };
}

/**
 * Splits streamed reasoning at its last paragraph break so finished
 * paragraphs can move to static history. Gemini summaries stay whole.
 */
export function splitFinishedThought(text: string): [string, string] {
  if (isThoughtHeading(text)) {
    return ['', text];
  }
  const end = text.lastIndexOf('\n\n');
  return end > 0 ? [text.slice(0, end), text.slice(end + 2)] : ['', text];
}

export function toThoughtStatus(text: string): ThoughtSummary {
  return isThoughtHeading(text)
    ? parseThought(text)
    : { subject: '', description: '' };
}
