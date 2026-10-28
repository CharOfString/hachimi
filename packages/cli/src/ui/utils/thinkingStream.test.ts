/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  getThoughtText,
  isThoughtHeading,
  splitFinishedThought,
  toThoughtStatus,
  toThoughtSummary,
} from './thinkingStream.js';

describe('thinkingStream', () => {
  it('prefers raw thought text and rebuilds it otherwise', () => {
    expect(
      getThoughtText({ subject: '', description: 'word', text: ' word ' }),
    ).toBe(' word ');
    expect(getThoughtText({ subject: 'Plan', description: 'Steps' })).toBe(
      '**Plan**\n\nSteps',
    );
    expect(getThoughtText({ subject: '', description: 'Steps' })).toBe('Steps');
  });

  it('recognizes Gemini subject headings', () => {
    expect(isThoughtHeading('  **Plan** steps')).toBe(true);
    expect(isThoughtHeading('Plan **bold**')).toBe(false);
  });

  it('keeps provider reasoning as plain description text', () => {
    expect(toThoughtSummary('Check **this** first')).toEqual({
      subject: '',
      description: 'Check **this** first',
    });
    expect(toThoughtSummary('**Plan**\n\nSteps')).toEqual({
      subject: 'Plan',
      description: 'Steps',
    });
  });

  it('splits finished paragraphs from streamed reasoning only', () => {
    expect(splitFinishedThought('one\n\ntwo\n\nthr')).toEqual([
      'one\n\ntwo',
      'thr',
    ]);
    expect(splitFinishedThought('one two')).toEqual(['', 'one two']);
    expect(splitFinishedThought('**Plan**\n\nSteps')).toEqual([
      '',
      '**Plan**\n\nSteps',
    ]);
  });

  it('summarizes status as the subject and keeps reasoning out of it', () => {
    expect(toThoughtStatus('first\nsecond line\n\n').subject).toBe('');
    expect(toThoughtStatus('**Plan**\n\nSteps').subject).toBe('Plan');
  });
});
