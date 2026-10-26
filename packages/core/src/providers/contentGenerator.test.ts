/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { FinishReason, type GenerateContentParameters } from '@google/genai';
import {
  ProviderContentGenerator,
  openAIMessages,
  readSSE,
} from './contentGenerator.js';
import { stripToolCallIdPrefixes } from '../core/geminiChat.js';
import type { ProviderAccount } from './types.js';

const account: ProviderAccount = {
  id: 'account',
  name: 'Test',
  providerId: 'deepseek',
  protocol: 'openai',
  baseUrl: 'https://example.test/v1',
  model: 'chat',
  models: [{ id: 'chat' }, { id: 'reasoner' }],
};

function sse(events: unknown[]) {
  return new Response(
    events
      .map(
        (e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\r\n\r\n`,
      )
      .join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

afterEach(() => vi.unstubAllGlobals());
describe('provider protocol adapter', () => {
  it('routes auxiliary Gemini model names to the selected account model and joins streamed tools', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sse([
        { choices: [{ delta: { reasoning_content: 'think' } }] },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call1',
                    function: { name: 'read_file', arguments: '{"pa' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: 'th":"a"}' } }],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
        { choices: [], usage: { prompt_tokens: 10, completion_tokens: 4 } },
        '[DONE]',
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const generator = new ProviderContentGenerator(
      account,
      'private-key',
      () => 'reasoner',
    );
    const result = await generator.generateContent({
      model: 'gemini-flash',
      contents: 'hi',
      config: {
        abortSignal: controller.signal,
        tools: [
          {
            functionDeclarations: [
              { name: 'read_file', parametersJsonSchema: { type: 'object' } },
            ],
          },
        ],
      },
    });

    expect(result.functionCalls).toEqual([
      { id: 'call1', name: 'read_file', args: { path: 'a' } },
    ]);

    expect(result.candidates?.[0]?.content?.parts?.[0]).toEqual({
      text: 'think',
      thought: true,
    });

    expect(result.usageMetadata?.totalTokenCount).toBe(14);
    const history = [
      {
        role: 'model',
        parts: result.candidates![0].content!.parts!.filter(
          (part) => !part.thought,
        ),
      },
    ];
    const replay = openAIMessages({
      model: 'reasoner',
      contents: stripToolCallIdPrefixes(history, true),
    });

    expect(replay[0].reasoning_content).toBe('think');
    expect(
      stripToolCallIdPrefixes(history)[0].parts?.[0].thoughtSignature,
    ).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/v1/chat/completions');
    expect(JSON.parse(init.body).model).toBe('reasoner');
    expect(init.signal).toBe(controller.signal);
    expect(init.redirect).toBe('error');
  });

  it('preserves tool call IDs and reasoning across subsequent turns', () => {
    const request: GenerateContentParameters = {
      model: 'chat',
      contents: [
        {
          role: 'model',
          parts: [
            { text: 'thinking', thought: true },
            {
              functionCall: {
                name: 'read_file',
                id: 'call1',
                args: { path: 'a' },
              },
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call1',
                name: 'read_file',
                response: { output: 'contents' },
              },
            },
          ],
        },
      ],
    };

    const messages = openAIMessages(request);
    expect(messages[0]['reasoning_content']).toBe('thinking');
    expect(messages[1]).toMatchObject({ role: 'tool', tool_call_id: 'call1' });
  });

  it('parses Anthropic message and tool events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sse([
        { type: 'message_start', message: { usage: { input_tokens: 7 } } },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'tool1', name: 'read_file' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"path":"a"}' },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'tool_use' },
          usage: { output_tokens: 3 },
        },
        { type: 'message_stop' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new ProviderContentGenerator(
      { ...account, protocol: 'anthropic' },
      'key',
      () => 'chat',
    ).generateContent({
      model: 'chat',
      contents: 'hello',
      config: { systemInstruction: 'system' },
    });

    expect(result.functionCalls?.[0]).toEqual({
      id: 'tool1',
      name: 'read_file',
      args: { path: 'a' },
    });

    expect(result.usageMetadata?.totalTokenCount).toBe(10);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/v1/messages');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      system: 'system',
      max_tokens: 8192,
    });
  });

  it('rejects Gemini-only tools rather than pretending to execute them', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      new ProviderContentGenerator(
        account,
        'key',
        () => 'chat',
      ).generateContent({
        model: 'chat',
        contents: 'Search the web',
        config: { tools: [{ googleSearch: {} }] },
      }),
    ).rejects.toThrow('Gemini built-in tools');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not treat a truncated stream as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sse([{ choices: [{ delta: { content: 'partial' } }] }]),
        ),
    );
    await expect(
      new ProviderContentGenerator(
        account,
        'key',
        () => 'chat',
      ).generateContent({ model: 'chat', contents: 'hi' }),
    ).rejects.toThrow('before a completion marker');
  });

  it('reports HTTP status without exposing echoed API keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('private-key echoed', { status: 401 })),
    );
    await expect(
      new ProviderContentGenerator(
        account,
        'private-key',
        () => 'chat',
      ).generateContent({ model: 'chat', contents: 'hi' }),
    ).rejects.toThrow('HTTP 401');
  });

  it('parses split UTF-8 and multiline SSE data', async () => {
    const bytes = new TextEncoder().encode('data: 你好\r\ndata: world\r\n\r\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) {
          controller.enqueue(Uint8Array.of(byte));
        }

        controller.close();
      },
    });

    const result = [];
    for await (const event of readSSE(body)) {
      result.push(event);
    }

    expect(result).toEqual(['你好\nworld']);
  });

  it('emits the stop reason after streamed text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sse([
          {
            choices: [{ delta: { content: 'Hello' }, finish_reason: 'stop' }],
          },
          '[DONE]',
        ]),
      ),
    );
    const result = await new ProviderContentGenerator(
      account,
      'key',
      () => 'chat',
    ).generateContent({ model: 'chat', contents: 'hi' });
    expect(result.text).toBe('Hello');
    expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.STOP);
  });

  it('sends the user effort clamped to the model, else the preset default', async () => {
    const effortAccount: ProviderAccount = {
      ...account,
      model: 'tiered',
      models: [
        {
          id: 'tiered',
          reasoning: {
            thinking: true,
            efforts: ['high', 'max'],
            defaultEffort: 'high',
          },
        },
        { id: 'plain' },
      ],
    };
    const sent: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return sse([
          { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] },
          '[DONE]',
        ]);
      }),
    );
    let model = 'tiered';
    let effort: 'low' | 'xhigh' | undefined;
    const generator = new ProviderContentGenerator(
      effortAccount,
      'key',
      () => model,
      () => effort,
    );
    const send = () => generator.generateContent({ model, contents: 'hi' });

    await send();
    effort = 'low';
    await send();
    effort = 'xhigh';
    await send();
    model = 'plain';
    await send();

    expect(sent.map((body) => body['reasoning_effort'])).toEqual([
      'high',
      'high',
      'max',
      undefined,
    ]);
  });
});
