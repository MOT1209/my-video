import { execFile as execFileCallback } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const WINDOWS_BINARY_EXTENSIONS = new Set(['.exe', '.com']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const ALLOWED_DOMAINS = 'localhost,127.0.0.1,[::1]';
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

export function validateLocalGameUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new TypeError('Game URL must be an absolute local HTTP(S) URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('Game URL must use HTTP or HTTPS.');
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new TypeError('Agent Browser playtests are restricted to localhost, 127.0.0.1, or ::1.');
  }
  if (url.username || url.password) {
    throw new TypeError('Credentials are not allowed in the game URL.');
  }
  return url;
}

function requireSafeName(value, label) {
  if (typeof value !== 'string' || !SAFE_NAME.test(value)) {
    throw new TypeError(`${label} must contain only letters, numbers, dot, underscore, and hyphen.`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
}

export function createAgentBrowserAdapter({
  session = `game-playtest-${randomUUID()}`,
  outputDir = './test-artifacts/agent-browser',
  binary = process.env.AGENT_BROWSER_BIN || 'agent-browser',
  binaryArgs = [],
  timeoutMs = 30_000,
  env = process.env,
} = {}) {
  requireText(binary, 'Agent Browser executable');
  if (!Array.isArray(binaryArgs) || binaryArgs.some((arg) => typeof arg !== 'string')) {
    throw new TypeError('Executable arguments must be an array of strings.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('Command timeout must be a positive integer in milliseconds.');
  }

  const artifactDirectory = path.resolve(outputDir);
  const sessionName = requireSafeName(session, 'Session name');
  let targetOrigin;
  let scenarioRunning = false;

  async function runCli(...args) {
    if (process.platform === 'win32' && !WINDOWS_BINARY_EXTENSIONS.has(path.extname(binary).toLowerCase())) {
      throw new Error('On Windows, set AGENT_BROWSER_BIN to the direct agent-browser .exe path; .cmd shims are not invoked through a shell.');
    }
    const { stdout } = await execFile(binary, [...binaryArgs, ...args], {
      env,
      timeout: timeoutMs,
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout.trim();
  }

  function sessionCommand(...args) {
    return runCli('--session', sessionName, '--allowed-domains', ALLOWED_DOMAINS, ...args);
  }

  async function verifySameOrigin(expectedOrigin = targetOrigin) {
    if (!expectedOrigin) throw new Error('Open an approved local game URL before checking the browser origin.');
    const currentUrl = validateLocalGameUrl(await sessionCommand('get', 'url'));
    const expectedUrl = new URL(expectedOrigin);
    if (currentUrl.protocol !== expectedUrl.protocol || currentUrl.hostname !== expectedUrl.hostname || currentUrl.port !== expectedUrl.port) {
      throw new Error(`Navigation left the approved local game origin (${currentUrl.origin}).`);
    }
    return currentUrl.href;
  }

  function validateScenarioStep(step) {
    const supportedActions = ['click', 'fill', 'press', 'waitForText', 'waitForSelector', 'snapshot', 'getText', 'screenshot'];
    if (!supportedActions.includes(step.action)) {
      throw new TypeError(`Unsupported playtest action: ${String(step.action)}`);
    }
    if (['click', 'fill', 'waitForSelector', 'getText'].includes(step.action)) requireText(step.selector, `${step.action} selector`);
    if (step.action === 'press') requireText(step.key, 'Key');
    if (step.action === 'waitForText') requireText(step.text, 'Expected text');
    if (step.action === 'fill' && typeof step.text !== 'string') throw new TypeError('Fill text must be a string.');
  }

  async function runStep(step, index, scenarioId, runId) {
    switch (step.action) {
      case 'click':
        return sessionCommand('click', requireText(step.selector, 'Click selector'));
      case 'fill':
        return sessionCommand('fill', requireText(step.selector, 'Fill selector'), String(step.text ?? ''));
      case 'press':
        return sessionCommand('press', requireText(step.key, 'Key'));
      case 'waitForText':
        return sessionCommand('wait', '--text', requireText(step.text, 'Expected text'));
      case 'waitForSelector':
        return sessionCommand('wait', requireText(step.selector, 'Readiness selector'));
      case 'snapshot':
        return sessionCommand('snapshot', '-i');
      case 'getText':
        return sessionCommand('get', 'text', requireText(step.selector, 'Text selector'));
      case 'screenshot': {
        const fileName = `${scenarioId}-${runId}-${String(index + 1).padStart(2, '0')}.png`;
        const evidencePath = path.join(artifactDirectory, fileName);
        await sessionCommand('screenshot', evidencePath);
        const evidence = await stat(evidencePath);
        if (!evidence.isFile() || evidence.size === 0) {
          throw new Error(`Screenshot evidence was not written: ${evidencePath}`);
        }
        return evidencePath;
      }
      default:
        throw new TypeError(`Unsupported playtest action: ${String(step.action)}`);
    }
  }

  async function waitForReadiness(readiness) {
    const args = readiness.flag
      ? ['wait', readiness.flag, readiness.value]
      : ['wait', readiness.value];
    return sessionCommand(...args);
  }

  async function close() {
    return sessionCommand('close');
  }

  function selectReadinessSignal(readiness) {
    if (typeof readiness?.text === 'string' && readiness.text.trim()) {
      return { flag: '--text', value: readiness.text };
    }
    if (typeof readiness?.selector === 'string' && readiness.selector.trim()) {
      return { flag: null, value: readiness.selector };
    }
    throw new TypeError('Scenario requires a game-specific ready.text or ready.selector signal.');
  }

  async function runScenario(scenario) {
    const scenarioId = requireSafeName(scenario?.id, 'Scenario ID');
    const gameUrl = validateLocalGameUrl(scenario?.url);
    const readiness = selectReadinessSignal(scenario?.ready);
    if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
      throw new TypeError('Scenario requires at least one explicit step.');
    }
    for (const step of scenario.steps) {
      if (!step || typeof step !== 'object' || Array.isArray(step)) {
        throw new TypeError('Each scenario step must be an action object.');
      }
      validateScenarioStep(step);
    }

    await mkdir(artifactDirectory, { recursive: true });
    if (scenarioRunning) throw new Error('A playtest scenario is already using this browser session.');
    scenarioRunning = true;
    const runId = randomUUID();
    const evidence = [];
    let failure;
    let browserOpened = false;
    let finalUrl;

    try {
      await runCli('--version');
      browserOpened = true;
      await sessionCommand('open', gameUrl.href);
      await verifySameOrigin(gameUrl.origin);
      await waitForReadiness(readiness);
      await verifySameOrigin(gameUrl.origin);

      for (const [index, step] of scenario.steps.entries()) {
        const output = await runStep(step, index, scenarioId, runId);
        finalUrl = await verifySameOrigin(gameUrl.origin);
        evidence.push({ index: index + 1, action: step.action, output });
      }

      const pageErrors = await sessionCommand('errors');
      const consoleOutput = await sessionCommand('console');
      return { id: scenarioId, runId, session: sessionName, finalUrl, evidence, pageErrors, consoleOutput };
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      try {
        if (browserOpened) await close();
      } catch (closeError) {
        if (failure) {
          throw new AggregateError([failure, closeError], 'Playtest failed and its browser session could not be closed.');
        }
        throw closeError;
      } finally {
        scenarioRunning = false;
      }
    }
  }

  return {
    checkAvailable: () => runCli('--version'),
    openLocal: async (url) => {
      const gameUrl = validateLocalGameUrl(url);
      await runCli('--version');
      targetOrigin = gameUrl.origin;
      await sessionCommand('open', gameUrl.href);
      return verifySameOrigin();
    },
    waitReady: async (condition) => {
      if (scenarioRunning) throw new Error('A playtest scenario is already using this browser session.');
      if (!targetOrigin) throw new Error('Call openLocal before waiting for game readiness.');
      if (!condition || typeof condition !== 'object') {
        throw new TypeError('Provide a game-specific readiness text or selector.');
      }
      await waitForReadiness(selectReadinessSignal(condition));
      return verifySameOrigin();
    },
    runScenario,
    close,
  };
}
