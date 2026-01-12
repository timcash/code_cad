import { mkdirSync } from 'fs';
import { appendFile } from 'fs/promises';
import { dirname, join } from 'path';
import { LogEntry, LogMessage, LogServiceConfig, LogServiceOptions, formatLogLine } from './log_common';

type IncomingMessage = LogMessage | Record<string, unknown>;
const DEFAULT_HOSTNAME = '127.0.0.1';
const DEFAULT_PORT = 9776;
const DEFAULT_LOG_DIR = 'logs';
const serverRoot = dirname(Bun.fileURLToPath(import.meta.url));

type BunLogServer = Bun.Server;

export class LogService {
  private server: BunLogServer | null = null;
  private config: LogServiceConfig;
  private timestamp: string;

  constructor(options: LogServiceOptions = {}) {
    this.timestamp = this.getFileFriendlyTimestamp();
    const projectRoot = process.cwd(); // Assume CWD is project root
    this.config = {
      hostname: options.hostname ?? DEFAULT_HOSTNAME,
      port: typeof options.port === 'number' && Number.isFinite(options.port) ? options.port : DEFAULT_PORT,
      logDir: join(projectRoot, options.logDir ?? DEFAULT_LOG_DIR),
      consoleLogging: options.consoleLogging ?? true
    };
    this.ensureDirectoryExists(this.config.logDir);
  }

  ensureDirectoryExists(targetPath: string): void {
    mkdirSync(targetPath, { recursive: true });
  }

  async writeEntry(defaultBaseDir: string, service: string, entry: LogEntry, consoleLogging: boolean): Promise<void> {
    const line = formatLogLine(entry, service);
    const targetDir = defaultBaseDir;
    // Filename format: <timestamp>_<service>.log
    const targetFile = join(targetDir, `${this.timestamp}_${service}.log`);
    // Combined log: <timestamp>_all.log
    const allLogFile = join(targetDir, `${this.timestamp}_all.log`);

    // Write to individual service log file
    await appendFile(targetFile, line);

    // Write to combined all.log file
    await appendFile(allLogFile, line);

    if (consoleLogging) {
      console.log(line.trimEnd());
    }
  }

  parseMessage(data: string): IncomingMessage | undefined {
    try {
      return JSON.parse(data) as IncomingMessage;
    } catch (error) {
      if (this.config.consoleLogging) {
        console.warn('Failed to parse incoming log payload:', error);
      }
      return undefined;
    }
  }


  private getFileFriendlyTimestamp(): string {
    // format YYYY_MM_DD_HH_MM_SS
    return new Date().toISOString().slice(0, 19).replace(/-/g, '_').replace(/:/g, '_');
  }

  isValidMessage(payload: IncomingMessage): payload is LogMessage {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    if (payload.type !== 'log_entry') {
      return false;
    }

    if (typeof payload.service !== 'string' || typeof payload.entry !== 'object' || payload.entry === null) {
      return false;
    }

    const entry = payload.entry as LogEntry;
    return (
      typeof entry.message === 'string' &&
      typeof entry.timestamp === 'string' &&
      typeof entry.level === 'string' &&
      typeof entry.caller === 'string'
    );
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    console.log(`📝 Log service starting on ws://${this.config.hostname}:${this.config.port}`);
    console.log(`📁 Writing logs to: ${this.config.logDir}`);
    console.log(`🖥️ Console logging ${this.config.consoleLogging ? 'enabled' : 'disabled'}`);

    this.server = Bun.serve<{ socketId: string }, Record<string, never>>({
      hostname: this.config.hostname,
      port: this.config.port,
      fetch: (req, server) => {
        if (server.upgrade(req)) {
          return undefined;
        }

        return new Response('Log service is running. Connect via WebSocket.', { status: 200 });
      },
      websocket: {
        open: (ws) => {
          ws.data = { socketId: crypto.randomUUID() };
          if (this.config.consoleLogging) {
            console.log(`🔌 Client connected (${ws.data.socketId})`);
          }
        },
        message: async (ws, message) => {
          if (typeof message !== 'string') {
            if (this.config.consoleLogging) {
              console.warn('Received non-string payload, ignoring.');
            }
            return;
          }

          const parsed = this.parseMessage(message);
          if (!parsed) {
            ws.send(JSON.stringify({ status: 'error', reason: 'invalid_json' }));
            return;
          }

          if (!this.isValidMessage(parsed)) {
            ws.send(JSON.stringify({ status: 'error', reason: 'invalid_payload' }));
            return;
          }

          try {
            await this.writeEntry(this.config.logDir, parsed.service, parsed.entry, this.config.consoleLogging);
            ws.send(JSON.stringify({ status: 'ok' }));
          } catch (error) {
            if (this.config.consoleLogging) {
              console.error('Failed to write log batch:', error);
            }
            ws.send(JSON.stringify({ status: 'error', reason: 'write_failed' }));
          }
        },
        close: (ws) => {
          if (this.config.consoleLogging) {
            console.log(`🔌 Client disconnected (${ws.data.socketId})`);
          }
        }
      },
      error: (error) => {
        if (this.config.consoleLogging) {
          console.error('⚠️ WebSocket error:', error);
        }
      }
    });

    // try to ping the server with a fetch to its root every 100ms. max 1 second
    let started = false;
    for (let i = 0; i < 10; i++) {
      const response = await fetch(`http://${this.server.hostname}:${this.server.port}`);
      if (response.ok) {
        started = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!started) {
      throw new Error(`Failed to start log service at http://${this.server.hostname}:${this.server.port}`);
    }

    if (this.server) {
      console.log(`✅ Log service listening on ws://${this.server.hostname}:${this.server.port}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    // Give time for any pending log writes to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    this.server.stop();
    this.server.unref();
    this.server = null;
    // Give server time to close connections
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getHostname(): string {
    return this.server?.hostname ?? this.config.hostname;
  }

  getPort(): number {
    return this.server?.port ?? this.config.port;
  }

  getLogDir(): string {
    return this.config.logDir;
  }
}

if (import.meta.main) {
  const service = new LogService({ consoleLogging: true });
  await service.start();
  // Keep alive
}