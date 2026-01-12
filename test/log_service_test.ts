import { readFileSync, readdirSync, existsSync } from 'fs';
import { join} from 'path';
import { Logger } from './log';
import { LogService } from './log_service';

const SERVICE_CASES = [
  {
    name: 'cli-test-service',
    message: 'hello from cli log server test'
  },
  {
    name: 'cli-test-service-2',
    message: 'hello from second cli log server test'
  }
] as const;



async function waitFor(predicate: () => boolean, timeoutMs = 5000, intervalMs = 50): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await Bun.sleep(intervalMs);
  }
  throw new Error('Timed out waiting for condition');
}

export async function main(): Promise<void> {
  let logService: LogService = new LogService({
    hostname: '127.0.0.1',
    port: 55111,
    logDir: 'logs',
    consoleLogging: false
  });
  try {
    await logService.start();
    await logService.start();

    const serverUrl = `ws://${logService.getHostname()}:${logService.getPort()}`;
    const fullLogDir = logService.getLogDir();
    const loggers = SERVICE_CASES.map(({ name }) => new Logger(name, {
      serverUrl,
      consoleLogging: false
    }));

    for (let i = 0; i < SERVICE_CASES.length; i++) {
      const { message } = SERVICE_CASES[i];
      loggers[i].info(message);
    }

    const expectedFiles = SERVICE_CASES.map(({ name }) => join(fullLogDir, `${name}.log`));

    await waitFor(() => existsSync(fullLogDir) && readdirSync(fullLogDir).length >= SERVICE_CASES.length);
    await waitFor(() => expectedFiles.every((file) => existsSync(file)));

    for (let i = 0; i < SERVICE_CASES.length; i++) {
      const { message } = SERVICE_CASES[i];
      const filePath = expectedFiles[i];
      const contents = readFileSync(filePath, 'utf8');
      if (!contents.includes(message)) {
        throw new Error(`Log file ${filePath} does not contain expected message`);
      }
    }

    console.log('✅ Multiple log files created and contain the expected messages.');
    for (const logger of loggers) {
      logger.dispose();
    }

    await logService.stop();
    await logService.stop();

    await logService.start();
    await logService.start();

    const secondServerUrl = `ws://${logService.getHostname()}:${logService.getPort()}`;
    const secondLoggers = SERVICE_CASES.map(({ name }, index) => new Logger(name, {
      serverUrl: secondServerUrl,
      consoleLogging: false
    }));

    for (let i = 0; i < SERVICE_CASES.length; i++) {
      const message = `${SERVICE_CASES[i].message} (second-run)`;
      secondLoggers[i].info(message);
    }

    await waitFor(() => expectedFiles.every((file) => existsSync(file)));

    for (let i = 0; i < SERVICE_CASES.length; i++) {
      const message = `${SERVICE_CASES[i].message} (second-run)`;
      const filePath = expectedFiles[i];
      await waitFor(() => existsSync(filePath) && readFileSync(filePath, 'utf8').includes(message));
    }

    console.log('✅ Log service handled start/stop cycle and second run messages.');

    for (const logger of secondLoggers) {
      logger.dispose();
    }

    await logService.stop();
    await logService.stop();
  } finally {
    await logService?.stop();
    Logger.shutdown();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Log service test failed:', error);
    process.exit(1);
  });
}