import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAgentBrowserAdapter, validateLocalGameUrl } from './agent-browser-playtest.mjs';

async function makeFakeCli(directory) {
  const callLog = path.join(directory, 'calls.jsonl');
  const scriptPath = path.join(directory, 'fake-agent-browser.mjs');
  await writeFile(scriptPath, `
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const args = process.argv.slice(2);
await appendFile(process.env.FAKE_CLI_LOG, JSON.stringify(args) + '\\n');
if (args[0] === '--version') { console.log('agent-browser test-fake'); process.exit(0); }
const commandIndex = args.findIndex((arg) => ['open','get','wait','click','fill','press','snapshot','screenshot','errors','console','close'].includes(arg));
const command = args[commandIndex];
const commandArgs = args.slice(commandIndex + 1);
if (command === 'get' && commandArgs[0] === 'url') console.log(process.env.FAKE_CURRENT_URL || 'http://127.0.0.1:4173/');
if (command === 'screenshot') { await mkdir(path.dirname(commandArgs[0]), { recursive: true }); await appendFile(commandArgs[0], 'fake-png'); }
if (command === 'errors') console.log('No page errors');
if (command === 'console') console.log('No console messages');
`);
  return { callLog, scriptPath };
}

async function createTestAdapter(tempDir, fakeCli, extra = {}) {
  const outputDir = path.join(tempDir, 'artifacts');
  const testEnv = { ...process.env, FAKE_CLI_LOG: fakeCli.callLog, FAKE_CURRENT_URL: 'http://localhost:4173/' };
  const testAdapter = createAgentBrowserAdapter({
    binary: process.execPath,
    binaryArgs: [fakeCli.scriptPath],
    session: 'adapter-contract-test',
    outputDir,
    env: testEnv,
    ...extra,
  });
  return { adapter: testAdapter, outputDir };
}

async function readCalls(logPath) {
  const content = await readFile(logPath, 'utf8');
  return content.trim().split('\n').map((line) => JSON.parse(line));
}

test('accepts only credential-free HTTP(S) loopback game URLs', () => {
  assert.throws(() => validateLocalGameUrl('http://localhost./'), /restricted to localhost/);
  assert.equal(validateLocalGameUrl('http://localhost:4173/game').origin, 'http://localhost:4173');
  assert.equal(validateLocalGameUrl('https://[::1]:4173').hostname, '[::1]');
  assert.throws(() => validateLocalGameUrl('https://example.com'), /restricted to localhost/);
  assert.throws(() => validateLocalGameUrl('http://127.0.0.1@evil.com:4173'), /restricted to localhost/);
  assert.throws(() => validateLocalGameUrl('file:///tmp/game/index.html'), /HTTP or HTTPS/);
  assert.throws(() => validateLocalGameUrl('http://user:pass@localhost:4173'), /Credentials/);
});

test('runs a declared local scenario, captures evidence, collects diagnostics, and closes', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-browser-adapter-'));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const fakeCli = await makeFakeCli(tempDir);
  const { adapter, outputDir } = await createTestAdapter(tempDir, fakeCli);

  const report = await adapter.runScenario({
    id: 'start-game',
    url: 'http://localhost:4173/',
    ready: { selector: '#game-ready' },
    steps: [
      { action: 'snapshot' },
      { action: 'click', selector: '#start' },
      { action: 'screenshot' },
    ],
  });

  assert.equal(report.id, 'start-game');
  assert.match(report.runId, /^[0-9a-f-]{36}$/);
  assert.equal(report.session, 'adapter-contract-test');
  assert.equal(report.finalUrl, 'http://localhost:4173/');
  assert.match(report.pageErrors, /No page errors/);
  assert.match(report.consoleOutput, /No console messages/);
  assert.equal(report.evidence.length, 3);
  assert.equal(await readFile(report.evidence[2].output, 'utf8'), 'fake-png');
  assert.match(path.basename(report.evidence[2].output), new RegExp(`^start-game-${report.runId}-03\\.png$`));
  const calls = await readCalls(fakeCli.callLog);
  assert.ok(calls.some((args) => args.includes('--allowed-domains') && args.includes('localhost,127.0.0.1,[::1]')));
  assert.ok(calls.some((args) => args.at(-1) === 'close'));
  assert.equal(await readFile(path.join(outputDir, path.basename(report.evidence[2].output)), 'utf8'), 'fake-png');
});

test('uses a valid selector when readiness text is malformed', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-browser-adapter-'));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const fakeCli = await makeFakeCli(tempDir);
  const { adapter } = await createTestAdapter(tempDir, fakeCli);

  await adapter.runScenario({
    id: 'valid-readiness-fallback',
    url: 'http://localhost:4173/',
    ready: { text: 7, selector: '#game-ready' },
    steps: [{ action: 'snapshot' }],
  });

  const waitCall = (await readCalls(fakeCli.callLog)).find((args) => args.includes('wait'));
  assert.ok(waitCall);
  assert.deepEqual(waitCall.slice(-2), ['wait', '#game-ready']);
});

test('openLocal and waitReady require and preserve a game-specific local origin', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-browser-adapter-'));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const fakeCli = await makeFakeCli(tempDir);
  const { adapter } = await createTestAdapter(tempDir, fakeCli);

  await assert.rejects(adapter.waitReady({ text: 'Ready' }), /Call openLocal before waiting/);
  assert.equal(await adapter.openLocal('http://localhost:4173/'), 'http://localhost:4173/');
  assert.equal(await adapter.waitReady({ selector: '#game-ready' }), 'http://localhost:4173/');
  await adapter.close();
});

test('rejects external origins before invoking the executable', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-browser-adapter-'));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const fakeCli = await makeFakeCli(tempDir);
  const { adapter } = await createTestAdapter(tempDir, fakeCli);

  await assert.rejects(adapter.runScenario({
    id: 'outside',
    url: 'https://example.com',
    ready: { text: 'Ready' },
    steps: [{ action: 'snapshot' }],
  }), /restricted to localhost/);
  await assert.rejects(readFile(fakeCli.callLog, 'utf8'), { code: 'ENOENT' });
});

test('fails closed on unsupported scenario actions before launching a browser session', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-browser-adapter-'));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const fakeCli = await makeFakeCli(tempDir);
  const { adapter } = await createTestAdapter(tempDir, fakeCli);

  await assert.rejects(adapter.runScenario({
    id: 'unsupported-action',
    url: 'http://localhost:4173/',
    ready: { text: 'Ready' },
    steps: [{ action: 'evaluate', script: 'document.cookie' }],
  }), /Unsupported playtest action: evaluate/);
  await assert.rejects(adapter.runScenario({
    id: 'missing-selector',
    url: 'http://localhost:4173/',
    ready: { text: 'Ready' },
    steps: [{ action: 'click' }],
  }), /click selector must be a non-empty string/);
  await assert.rejects(readFile(fakeCli.callLog, 'utf8'), { code: 'ENOENT' });
});

test('closes the browser if opening the requested origin redirects elsewhere', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-browser-adapter-'));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const fakeCli = await makeFakeCli(tempDir);
  const { adapter } = await createTestAdapter(tempDir, fakeCli, {
    env: { ...process.env, FAKE_CLI_LOG: fakeCli.callLog, FAKE_CURRENT_URL: 'http://localhost:4174/' },
  });

  await assert.rejects(adapter.runScenario({
    id: 'redirect-away',
    url: 'http://localhost:4173/',
    ready: { text: 'Ready' },
    steps: [{ action: 'snapshot' }],
  }), /left the approved local game origin/);
  assert.ok((await readCalls(fakeCli.callLog)).some((args) => args.at(-1) === 'close'));
});
