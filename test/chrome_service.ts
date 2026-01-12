import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { Logger } from './log';

const execAsync = promisify(exec);

const REMOTE_DEBUG_PORT = 9222;
const USER_DATA_DIR = path.join(process.cwd(), 'chrome-debug-data');
const STARTUP_TIMEOUT_MS = 5000;
const STARTUP_RETRY_INTERVAL_MS = 250;

export class ChromeService {
  private logger: Logger;
  private browser: Browser | null = null;
  private remoteDebugPort: number = REMOTE_DEBUG_PORT;
  private chromeProcess: ReturnType<typeof spawn> | null = null;
  private killChromeOnStartup: boolean = false;
  private killChromeOnShutdown: boolean = false;

  constructor(logger: Logger, options: { killChromeOnStartup?: boolean; killChromeOnShutdown?: boolean } = {}) {
    this.logger = logger;
    this.killChromeOnStartup = options.killChromeOnStartup ?? false;
    this.killChromeOnShutdown = options.killChromeOnShutdown ?? false;
  }

  async start(remoteDebugPort: number = REMOTE_DEBUG_PORT, testConnection: boolean = true): Promise<void> {
    if (this.browser?.connected) {
      this.logger.debug('Chrome is already running, skipping new launch');
      return;
    }

    this.remoteDebugPort = remoteDebugPort;

    // First, try to connect to existing Chrome instance
    if (!this.killChromeOnStartup) {
      try {
        this.logger.debug(`Attempting to connect to existing Chrome on port ${this.remoteDebugPort}`);
        this.browser = await puppeteer.connect({
          browserURL: `http://localhost:${this.remoteDebugPort}`
        });

        // Only test the connection if requested (creates and closes a test page)
        if (testConnection) {
          const testPage = await this.browser.newPage();
          await testPage.close();
        }

        this.logger.debug('Successfully connected to existing Chrome instance');
        return;
      } catch (error) {
        this.logger.debug(`Could not connect to existing Chrome: ${error instanceof Error ? error.message : String(error)}`);
        // Continue to create new Chrome instance
      }
    }

    // If we can't connect to existing Chrome or killChromeOnStartup is true, create new instance
    if (this.killChromeOnStartup) {
      this.logger.debug('Kill Chrome on startup is enabled, terminating existing processes');
      await this.killChromeProcesses();
    }

    await fs.promises.mkdir(USER_DATA_DIR, { recursive: true });

    if (this.browser?.connected) {
      this.browser.disconnect();
    }
    this.browser = null;

    const chromePath = await this.findChromeExecutable();
    if (!chromePath) {
      throw new Error('Chrome executable not found in standard locations');
    }

    const args = [
      `--remote-debugging-port=${this.remoteDebugPort}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check'
    ];

    this.chromeProcess = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore'
    });

    this.logger.debug(`Started Chrome in debug mode on port ${this.remoteDebugPort}, waiting for availability`);

    try {
      this.browser = await this.waitForChromeReady();
      this.logger.debug('Chrome is ready to accept Puppeteer connections');
    } catch (error) {
      this.logger.error(`Failed to confirm Chrome availability: ${error}`);
      throw error;
    }
  }

  setRemoteDebugPort(port: number): void {
    this.remoteDebugPort = port;
    this.logger.debug(`Set remote debug port to ${port}`);
  }

  async connect(): Promise<Page> {
    if (!this.browser?.connected) {
      this.browser = await puppeteer.connect({
        browserURL: `http://localhost:${this.remoteDebugPort}`
      });
    }

    // Try to reuse an existing page first
    const pages = await this.browser.pages();
    if (pages.length > 0) {
      const existingPage = pages[0];
      await existingPage.setViewport({ width: 750, height: 750 });
      this.setupConsoleMonitoring(existingPage);
      this.logger.debug('Reusing existing Chrome page');
      return existingPage;
    }

    // Create new page only if no existing pages
    const page = await this.browser.newPage();
    await page.setViewport({ width: 750, height: 750 });
    this.setupConsoleMonitoring(page);
    this.logger.debug('Connected to Chrome and created a new page');
    return page;
  }

  async disconnect(): Promise<void> {
    if (!this.browser) {
      return;
    }

    this.browser.disconnect();
    this.logger.debug('Disconnected from Chrome');
  }

  async stop(): Promise<void> {
    if (this.browser) {
      try {
        if (this.killChromeOnShutdown) {
          await this.browser.close();
        } else {
          this.browser.disconnect();
        }
      } catch (error) {
        this.logger.warn(`Failed closing/disconnecting Puppeteer browser: ${error}`);
      } finally {
        this.browser = null;
      }
    }

    if (this.killChromeOnShutdown) {
      await this.terminateChromeProcess();

      try {
        await this.waitForDevToolsShutdown();
      } catch (error) {
        this.logger.warn(`Chrome DevTools endpoint did not shut down cleanly: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      this.logger.debug('Leaving Chrome running (killChromeOnShutdown is disabled)');
    }
  }

  private getChromePaths(): string[] {
    const platform = os.platform();

    if (platform === 'win32') {
      return [
        path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
      ];
    }

    if (platform === 'darwin') {
      return [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      ];
    }

    return [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable'
    ];
  }

  private async findChromeExecutable(): Promise<string | null> {
    const candidates = this.getChromePaths();

    for (const chromePath of candidates) {
      try {
        await fs.promises.access(chromePath, fs.constants.F_OK);
        return chromePath;
      } catch {
        // continue to next candidate
      }
    }

    return null;
  }

  private async killChromeProcesses(): Promise<void> {
    const platform = os.platform();

    try {
      if (platform === 'win32') {
        await execAsync('taskkill /F /IM chrome.exe /T');
      } else {
        await execAsync('pkill -f "Google Chrome"');
        await execAsync('pkill -f "chrome"');
      }
    } catch {
      // No existing process to terminate
    }
  }

  private async terminateChromeProcess(): Promise<void> {
    if (this.chromeProcess?.pid) {
      const pid = this.chromeProcess.pid;
      const platform = os.platform();

      try {
        if (platform === 'win32') {
          // Verify process exists first to avoid valid errors
          // Or just catch/ignore standard taskkill errors
          try {
            await execAsync(`taskkill /F /PID ${pid} /T`);
          } catch (e: any) {
            // If process not found (exit code 128) or "reason: ... not running", ignore
            const msg = e.message || e.toString();
            if (!msg.includes('not found') && !msg.includes('no running instance')) {
              // only warn if it's a real error
              this.logger.warn(`Taskkill warning for ${pid}: ${msg}`);
            }
          }
        } else {
          try {
            process.kill(-pid, 'SIGTERM');
          } catch {
            process.kill(pid, 'SIGTERM');
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to terminate Chrome process ${pid}: ${error instanceof Error ? error.message : String(error)}`);
        await this.killChromeProcesses();
      }
    } else {
      await this.killChromeProcesses();
    }

    this.chromeProcess = null;
  }

  private async waitForDevToolsShutdown(timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const available = await this.isDevToolsEndpointAvailable();
      if (!available) {
        return;
      }

      await ChromeService.delay(200);
    }

    throw new Error('Chrome DevTools endpoint remained reachable');
  }

  private async isDevToolsEndpointAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 250);

    try {
      const response = await fetch(`http://127.0.0.1:${this.remoteDebugPort}/json/version`, {
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private setupConsoleMonitoring(page: Page): void {
    page.on('console', async (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      let locationStr = 'unknown';

      if (location.url) {
        locationStr = location.url;
        if (location.lineNumber !== undefined) {
          locationStr += `:${location.lineNumber}`;
          if (location.columnNumber !== undefined) {
            locationStr += `:${location.columnNumber}`;
          }
        }
      }

      // For error messages, try to get more details from the args
      let fullMessage = text;
      if (type === 'error' && text.includes('JSHandle@')) {
        try {
          const args = msg.args();
          const errorDetails = [];
          for (const arg of args) {
            const argText = await arg.evaluate((el) => {
              if (el instanceof Error) {
                return `${el.name}: ${el.message}\n${el.stack}`;
              }
              return String(el);
            }).catch(() => String(arg));
            errorDetails.push(argText);
          }
          fullMessage = errorDetails.join(' ');
        } catch (e) {
          // Fallback to original text if evaluation fails
          fullMessage = text;
        }
      }

      switch (type) {
        case 'log':
        case 'info':
          this.logger.debug(`${fullMessage} (${locationStr})`);
          break;
        case 'warn':
          this.logger.warn(`${fullMessage} (${locationStr})`);
          break;
        case 'error':
          this.logger.error(`${fullMessage} (${locationStr})`);
          break;
        case 'debug':
          this.logger.debug(`${fullMessage} (${locationStr})`);
          break;
        default:
          this.logger.debug(`${fullMessage} (${locationStr})`);
          break;
      }
    });
  }

  private async waitForChromeReady(): Promise<Browser> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    let lastError: unknown;

    while (Date.now() < deadline) {
      let browser: Browser | null = null;

      try {
        browser = await puppeteer.connect({
          browserURL: `http://localhost:${this.remoteDebugPort}`
        });

        const page = await browser.newPage();
        await page.close();

        return browser;
      } catch (error) {
        lastError = error;

        if (browser) {
          browser.disconnect();
        }

        await ChromeService.delay(STARTUP_RETRY_INTERVAL_MS);
      }
    }

    throw new Error(`Timed out waiting for Chrome to become available${lastError ? `: ${lastError}` : ''}`);
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
