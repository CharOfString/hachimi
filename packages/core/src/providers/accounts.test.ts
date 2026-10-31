/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  accountStorePath,
  readAccounts,
  saveAccount,
  selectAccount,
  getActiveAccount,
  loadAccountKey,
  loadActiveAccountCredentials,
  deleteAccount,
  setModelContextWindow,
} from './accounts.js';
import type { ProviderAccount } from './types.js';

const secrets = vi.hoisted(() => new Map<string, string>());
vi.mock('../mcp/token-storage/hybrid-token-storage.js', () => ({
  HybridTokenStorage: class {
    async setCredentials(value: {
      serverName: string;
      token: { accessToken: string };
    }) {
      secrets.set(value.serverName, value.token.accessToken);
    }

    async getCredentials(id: string) {
      return secrets.has(id)
        ? { token: { accessToken: secrets.get(id) } }
        : null;
    }

    async deleteCredentials(id: string) {
      secrets.delete(id);
    }
  },
}));

let home: string;

const account = (name = 'Personal'): ProviderAccount => ({
  id: randomUUID(),
  name,
  providerId: 'deepseek',
  protocol: 'openai',
  baseUrl: 'https://api.deepseek.com',
  model: 'chat',
  models: [{ id: 'chat' }, { id: 'reasoner' }],
});

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'hachimi-accounts-'));
  vi.stubEnv('GEMINI_CLI_HOME', home);
  secrets.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(home, { recursive: true, force: true });
});

describe('provider accounts', () => {
  it('keeps same-provider accounts and credentials separate across selection and reload', async () => {
    const personal = account();
    const work = account('Work');
    await saveAccount(personal, 'personal-secret');
    await saveAccount(work, 'work-secret');
    selectAccount(personal.id, 'reasoner');
    expect(getActiveAccount()?.model).toBe('reasoner');
    selectAccount(work.id);
    expect(getActiveAccount()?.name).toBe('Work');
    expect(await loadAccountKey(personal.id)).toBe('personal-secret');
    expect(await loadAccountKey(work.id)).toBe('work-secret');
    expect(readAccounts().accounts).toHaveLength(2);
    expect(fs.readFileSync(accountStorePath(), 'utf8')).not.toContain('secret');
    if (process.platform !== 'win32') {
      expect(fs.statSync(accountStorePath()).mode & 0o777).toBe(0o600);
    }
  });

  it('binds endpoint and key to an immutable runtime snapshot', async () => {
    const a = account();
    await saveAccount(a, 'old-key');
    selectAccount(a.id);
    const original = await loadActiveAccountCredentials();
    await saveAccount({ ...a, baseUrl: 'https://new.example/v1' }, 'new-key');
    const updated = await loadActiveAccountCredentials();
    expect(original.account.baseUrl).toBe('https://api.deepseek.com');
    expect(original.apiKey).toBe('old-key');
    expect(updated.account.baseUrl).toBe('https://new.example/v1');
    expect(updated.apiKey).toBe('new-key');
  });

  it('does not touch Gemini settings, and deactivation preserves saved accounts', async () => {
    fs.mkdirSync(path.join(home, '.gemini'));
    const settings = path.join(home, '.gemini/settings.json');
    fs.writeFileSync(
      settings,
      '{"security":{"auth":{"selectedType":"oauth-personal"}}}',
    );
    const original = fs.readFileSync(settings, 'utf8');
    const saved = account();
    await saveAccount(saved, 'test-key');
    selectAccount(saved.id);
    selectAccount(undefined);
    expect(getActiveAccount()).toBeUndefined();
    expect(readAccounts().accounts).toHaveLength(1);
    expect(fs.readFileSync(settings, 'utf8')).toBe(original);
  });

  it('edits keep the key unless replaced and deletion removes only the selected account', async () => {
    const a = account();
    const b = account();
    await saveAccount(a, 'one');
    await saveAccount(b, 'two');
    await saveAccount({ ...a, name: 'Renamed' });
    expect(await loadAccountKey(a.id)).toBe('one');
    await saveAccount(a, 'replacement');
    expect(await loadAccountKey(a.id)).toBe('replacement');
    selectAccount(a.id);
    await deleteAccount(a.id);
    expect(getActiveAccount()).toBeUndefined();
    expect(await loadAccountKey(a.id)).toBeUndefined();
    expect(await loadAccountKey(b.id)).toBe('two');
  });

  it('rejects unknown accounts, models and credential-bearing endpoints without replacing the store', async () => {
    const a = account();
    await saveAccount(a, 'key');
    selectAccount(a.id);
    expect(() => selectAccount(randomUUID())).toThrow('Account not found');
    expect(() => selectAccount(a.id, 'unknown')).toThrow(
      'Model not configured',
    );
    await expect(
      saveAccount({ ...a, baseUrl: 'https://user:pass@example.com' }, 'key'),
    ).rejects.toThrow();
    expect(getActiveAccount()).toEqual(a);
  });

  it('refuses to overwrite corrupt account files', async () => {
    const a = account();
    await saveAccount(a, 'key');
    fs.writeFileSync(accountStorePath(), 'not-json');
    expect(() => selectAccount(a.id)).toThrow('Cannot read Hachimi accounts');
    expect(fs.readFileSync(accountStorePath(), 'utf8')).toBe('not-json');
  });
  it('declares and clears one model context window without touching others', async () => {
    const a = account();
    await saveAccount(a, 'key');
    setModelContextWindow(a.id, 'reasoner', 1_000_000);
    expect(readAccounts().accounts[0].models).toEqual([
      { id: 'chat' },
      { id: 'reasoner', contextWindowSize: 1_000_000 },
    ]);
    await saveAccount({ ...readAccounts().accounts[0], name: 'Renamed' });
    expect(readAccounts().accounts[0].models[1].contextWindowSize).toBe(
      1_000_000,
    );
    setModelContextWindow(a.id, 'reasoner');
    expect(readAccounts().accounts[0].models[1]).toEqual({ id: 'reasoner' });
    expect(() => setModelContextWindow(a.id, 'unknown', 1)).toThrow(
      'Model not configured',
    );
    expect(() => setModelContextWindow(a.id, 'chat', 0)).toThrow();
    expect(readAccounts().accounts[0].models[0]).toEqual({ id: 'chat' });
  });
});
