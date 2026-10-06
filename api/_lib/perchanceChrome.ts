import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { perchanceGenerateUrl, parsePerchanceFrameText } from '../../src/adapters/imagegen/perchanceUrl.ts';

const GENERATION_TIMEOUT_MS = 85_000;

type CdpResult = {
  result?: { value?: unknown };
};

class Cdp {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (value: CdpResult) => void; reject: (err: Error) => void }>();
  private ready: Promise<void>;

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', () => reject(new Error('Chrome DevTools connection failed.')));
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: CdpResult; error?: { message?: string } };
      if (!msg.id || !this.pending.has(msg.id)) return;
      const waiter = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(msg.error.message || 'Chrome DevTools call failed.'));
      else waiter.resolve(msg.result ?? {});
    });
  }

  async send(method: string, params: Record<string, unknown> = {}, timeoutMs = 8000): Promise<CdpResult> {
    await this.ready;
    const id = ++this.id;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Chrome DevTools timed out.'));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.ws.send(payload);
    });
  }

  close() {
    this.ws.close();
  }
}

async function waitForPort(dir: string): Promise<number> {
  const file = path.join(dir, 'DevToolsActivePort');
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    try {
      const raw = await readFile(file, 'utf8');
      const port = Number(raw.split('\n')[0]);
      if (port > 0) return port;
    } catch {
      // Chrome writes this file once the debugging port is ready.
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Chrome did not open a debugging port.');
}

async function frameText(wsUrl: string): Promise<string> {
  const cdp = new Cdp(wsUrl);
  try {
    const res = await cdp.send('Runtime.evaluate', {
      expression: '(document.body && document.body.innerText || "").slice(0, 2000)',
      returnByValue: true,
    });
    const value = res.result?.value;
    return typeof value === 'string' ? value : '';
  } finally {
    cdp.close();
  }
}

function killChrome(child: ChildProcess | null) {
  if (!child || child.killed) return;
  child.kill('SIGKILL');
}

let queue: Promise<unknown> = Promise.resolve();

export function generatePerchanceImage(prompt: string): Promise<{ url: string }> {
  const run = queue.then(() => generateOnce(prompt));
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function generateOnce(prompt: string): Promise<{ url: string }> {
  const id = `cc${Math.random().toString(36).slice(2, 10)}`;
  const pageUrl = perchanceGenerateUrl(prompt, id);
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'cc-perchance-'));
  const chromeBin = process.env.PERCHANCE_CHROME || 'google-chrome';
  const display = process.env.DISPLAY || ':1';
  let child: ChildProcess | null = null;
  try {
    child = spawn(
      chromeBin,
      [
        '--remote-debugging-port=0',
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--window-size=1100,900',
        'about:blank',
      ],
      { env: { ...process.env, DISPLAY: display }, stdio: 'ignore' },
    );
    child.once('error', () => {
      // Spawn failures surface when the debugging port never appears.
    });

    const port = await Promise.race([
      waitForPort(userDataDir),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Chrome took too long to start.')), 20_000)),
    ]);

    let pageWs = '';
    for (let i = 0; i < 30 && !pageWs; i++) {
      try {
        const tabs = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())) as Array<{
          type?: string;
          webSocketDebuggerUrl?: string;
        }>;
        pageWs = tabs.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl || '';
      } catch {
        pageWs = '';
      }
      if (!pageWs) await new Promise((r) => setTimeout(r, 150));
    }
    if (!pageWs) throw new Error('Chrome did not open a page.');

    const page = new Cdp(pageWs);
    try {
      await page.send('Page.enable');
      await page.send('Page.addScriptToEvaluateOnNewDocument', {
        source: 'Object.defineProperty(navigator,"webdriver",{get(){return false}})',
      });
      await page.send('Page.navigate', { url: pageUrl });
    } finally {
      page.close();
    }

    const started = Date.now();
    while (Date.now() - started < GENERATION_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 2500));
      let targets: Array<{ type?: string; url?: string; webSocketDebuggerUrl?: string }> = [];
      try {
        targets = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())) as typeof targets;
      } catch {
        continue;
      }
      for (const target of targets) {
        if (!target.webSocketDebuggerUrl) continue;
        if (target.type !== 'page' && target.type !== 'iframe') continue;
        if (String(target.url || '').startsWith('chrome-extension')) continue;
        let text = '';
        try {
          text = await frameText(target.webSocketDebuggerUrl);
        } catch {
          continue;
        }
        const parsed = parsePerchanceFrameText(text);
        if (parsed) return parsed;
      }
    }
    throw new Error(
      'Perchance did not return an image. The free generator is ad-funded, rate-limited, and may reject automated browsers.',
    );
  } finally {
    killChrome(child);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
