import type { LogEntry, LogLevel, LogMessage } from './log_common';
export interface LoggerOptions {
  serverUrl?: string;
  consoleLogging?: boolean;
  consoleMinLogLevel?: LogLevel;
  maxBufferSize?: number;
}

const DEFAULT_LOGGER_OPTIONS = {
  serverUrl: 'ws://localhost:9776',
  consoleLogging: false,
  consoleMinLogLevel: 'DEBUG' as LogLevel,
  maxBufferSize: 5000
} as const;

type InternalLoggerOptions = {
  serverUrl: string;
  consoleLogging: boolean;
  consoleMinLogLevel: LogLevel;
  maxBufferSize: number;
};

export class Logger {
  private static instances: Set<Logger> = new Set();
  private static hooksInstalled = false;

  static shutdown(): void {
    for (const logger of Array.from(Logger.instances)) {
      logger.dispose();
    }
  }

  private service: string;
  private config: InternalLoggerOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs = 1000;
  private isDisposed = false;
  private pendingQueue: LogEntry[] = [];
  private socket: WebSocket | null = null;

  constructor(service: string, options: LoggerOptions = {}) {
    this.service = service;
    this.config = {
      serverUrl: options.serverUrl ?? DEFAULT_LOGGER_OPTIONS.serverUrl,
      consoleLogging: options.consoleLogging ?? DEFAULT_LOGGER_OPTIONS.consoleLogging,
      consoleMinLogLevel: options.consoleMinLogLevel ?? DEFAULT_LOGGER_OPTIONS.consoleMinLogLevel,
      maxBufferSize: options.maxBufferSize ?? DEFAULT_LOGGER_OPTIONS.maxBufferSize
    };

    Logger.instances.add(this);
    Logger.ensureProcessHooks();

    this.connect();
  }

  private static ensureProcessHooks(): void {
    if (Logger.hooksInstalled) {
      return;
    }

    const drainAll = () => {
      for (const logger of Logger.instances) {
        logger.drainQueue();
      }
    };

    process.on('beforeExit', drainAll);
    process.on('exit', Logger.shutdown);
    process.on('SIGINT', Logger.shutdown);
    process.on('SIGTERM', Logger.shutdown);

    Logger.hooksInstalled = true;
  }

  private shouldLogToConsole(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.config.consoleMinLogLevel);
    return currentLevelIndex >= minLevelIndex;
  }

  private getCallerInfo(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown:0';
    
    const lines = stack.split('\n');
    // Skip the first 3 lines: Error, getCallerInfo, and the logging method
    // Look for the first line that's not from this file
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.includes('log.ts')) {
        // Try to extract function name, file path and line number from stack trace
        // Pattern 1: at functionName (file:line:column)
        let match = line.match(/at\s+([^(]+)\s+\(([^)]+):(\d+):\d+\)/);
        if (match) {
          const functionName = match[1].trim();
          const filePath = match[2];
          const lineNumber = match[3];
          const fileName = filePath.split(/[/\\]/).pop() || filePath;
          return `${fileName}:${lineNumber}:${functionName}`;
        }
        
        // Pattern 2: at file:line:column (no function name)
        match = line.match(/at\s+([^(]+):(\d+):\d+/);
        if (match) {
          const filePath = match[1];
          const lineNumber = match[2];
          const fileName = filePath.split(/[/\\]/).pop() || filePath;
          return `${fileName}:${lineNumber}`;
        }
        
        // Pattern 3: (file:line:column) format
        match = line.match(/\(([^)]+):(\d+):\d+\)/);
        if (match) {
          const filePath = match[1];
          const lineNumber = match[2];
          const fileName = filePath.split(/[/\\]/).pop() || filePath;
          return `${fileName}:${lineNumber}`;
        }
      }
    }
    return 'unknown:0';
  }

  private connect(): void {
    if (this.isDisposed) {
      return;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.socket = new WebSocket(this.config.serverUrl);
      this.socket.addEventListener('open', () => {
        this.reconnectDelayMs = 1000;
        this.drainQueue();
      });

      this.socket.addEventListener('close', () => {
        this.socket = null;
        this.scheduleReconnect();
      });

      this.socket.addEventListener('error', () => {
        if (this.socket) {
          this.socket.close();
        }
      });
    } catch (error) {
      console.warn(`Logger failed to connect to log server at ${this.config.serverUrl}: ${error}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isDisposed) {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    const delay = this.reconnectDelayMs;
    this.reconnectTimer = setTimeout(() => {
      if (this.isDisposed) {
        return;
      }

      this.reconnectTimer = null;
      this.connect();
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30000);
    }, delay);
  }

  private drainQueue(): void {
    if (this.isDisposed) {
      return;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.pendingQueue.length) {
      const entry = this.pendingQueue.shift();
      if (!entry) {
        continue;
      }
      if (!this.trySendEntry(entry)) {
        if (this.pendingQueue.length >= this.config.maxBufferSize) {
          this.pendingQueue.pop();
        }
        this.pendingQueue.unshift(entry);
        break;
      }
    }
  }

  private trySendEntry(entry: LogEntry): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const payload: LogMessage = {
      type: 'log_entry',
      service: this.service,
      entry
    };

    try {
      if (!this.isDisposed) {
        this.socket.send(JSON.stringify(payload));
      }
      return true;
    } catch (error) {
      console.warn(`Logger failed to send log entry: ${error}`);
      if (this.socket) {
        this.socket.close();
      }
      return false;
    }
  }

  private writeLog(level: LogLevel, message: string): void {
    if (this.isDisposed) {
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const entry: LogEntry = {
      level,
      message,
      timestamp,
      caller: this.getCallerInfo()
    };

    if (this.pendingQueue.length >= this.config.maxBufferSize) {
      this.pendingQueue.shift();
    }

    this.pendingQueue.push(entry);
    this.drainQueue();

    if (this.config.consoleLogging) {
      this.writeToConsole(entry);
    }
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.shouldLogToConsole(entry.level)) {
      return;
    }

    const consoleMessage = `[${entry.timestamp}, ${this.service}, ${entry.level}, ${entry.caller}] ${entry.message}`;
    switch (entry.level) {
      case 'DEBUG':
        console.debug(consoleMessage);
        break;
      case 'INFO':
        console.info(consoleMessage);
        break;
      case 'WARN':
        console.warn(consoleMessage);
        break;
      case 'ERROR':
        console.error(consoleMessage);
        break;
    }
  }

  debug(message: string): void {
    this.writeLog('DEBUG', message);
  }

  info(message: string): void {
    this.writeLog('INFO', message);
  }

  warn(message: string): void {
    this.writeLog('WARN', message);
  }

  error(message: string): void {
    this.writeLog('ERROR', message);
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.drainQueue();
    this.isDisposed = true;
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.pendingQueue.length = 0;
    Logger.instances.delete(this);
  }
}
