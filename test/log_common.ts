export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  caller: string;
}

export interface LogServiceOptions {
  hostname?: string;
  port?: number;
  logDir?: string;
  consoleLogging?: boolean;
}

export interface LogServiceConfig {
  hostname: string;
  port: number;
  logDir: string;
  consoleLogging: boolean;
}

export type LogMessage = {
  type: 'log_entry';
  service: string;
  entry: LogEntry;
};

export function formatLogLine(entry: LogEntry, service: string): string {
  return `[${entry.timestamp}, ${service}, ${entry.level}, ${entry.caller}] ${entry.message}\n`;
}
