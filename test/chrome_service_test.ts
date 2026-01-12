import { ChromeService } from './chrome_service';
import { Logger } from './log';

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isChromeAvailable(port: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 1000);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: controller.signal
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForChromeShutdown(port: number, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const available = await isChromeAvailable(port);
    if (!available) {
      return;
    }

    await delay(200);
  }

  throw new Error('Chrome DevTools endpoint is still reachable after stop()');
}

const chromeLogger = new Logger('chrome-service-test', {
  consoleLogging: true,
  consoleMinLogLevel: 'INFO'
});

export async function main(): Promise<void> {
  const testRemoteDebugPort = 9255;
  const chromeService = new ChromeService(chromeLogger);

  let stopCalled = false;

  try {
    await chromeService.start(testRemoteDebugPort);
    chromeLogger.info('Chrome service started');

    await chromeService.start(testRemoteDebugPort);
    chromeLogger.info('Chrome service start() is idempotent');

    const page = await chromeService.connect();
    chromeLogger.info('Chrome service connected');

    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
    chromeLogger.info('Navigated to https://www.google.com');

    await page.close();
    await chromeService.disconnect();
    chromeLogger.info('Chrome service disconnected');

    await chromeService.stop();
    stopCalled = true;
    chromeLogger.info('Chrome service stop() completed');

    await chromeService.stop();
    chromeLogger.info('Chrome service stop() second call had no effect');

    await chromeService.start(testRemoteDebugPort);
    chromeLogger.info('Chrome service restarted');

    await chromeService.start(testRemoteDebugPort);
    chromeLogger.info('Chrome service restart start() is idempotent');

    const restartPage = await chromeService.connect();
    await restartPage.goto('https://www.example.com', { waitUntil: 'domcontentloaded' });
    await restartPage.close();
    await chromeService.disconnect();
    chromeLogger.info('Chrome service operated after restart');

    await chromeService.stop();
    await chromeService.stop();
    chromeLogger.info('Chrome service stopped twice after restart');

    stopCalled = true;

    await waitForChromeShutdown(testRemoteDebugPort);
    chromeLogger.info('Chrome DevTools endpoint no longer reachable');
    chromeLogger.info('Chrome service test completed');
  } catch (error) {
    chromeLogger.error(`Chrome service test failed: ${error}`);
    throw error;
  } finally {
    if (!stopCalled) {
      try {
        await chromeService.stop();
      } catch {
        // Ignore cleanup failures
      }
    }

    Logger.shutdown();
  }
}

if (import.meta.main) {
  main().catch(() => {
    process.exitCode = 1;
  });
}


