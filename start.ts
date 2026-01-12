import { spawn, ChildProcess } from 'child_process';
import { mkdir, appendFile } from 'fs/promises';
import { join } from 'path';
import { killProcessesOnPorts } from './test/utils';

// Configuration
const LOG_DIR = 'logs';
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 8080;
const LOG_SERVICE_PORT = 9776; // If we decide to use it, but for now we'll just pipe stdout

async function ensureLogDir() {
    await mkdir(LOG_DIR, { recursive: true });
}

function getTimestamp() {
    return new Date().toISOString();
}

async function writeLog(message: string) {
    const timestamp = getTimestamp();
    const logLine = `[${timestamp}] ${message}\n`;
    process.stdout.write(logLine); // Show in console

    // Append to a daily log file or a run-specific log file
    // Let's use a run-specific one for clarity or just 'combined.log'
    // The user asked to "put them into logs folder".
    // Let's create a file based on start time.
    await appendFile(currentLogFile, logLine);
}

let currentLogFile: string;

function monitorProcess(name: string, proc: ChildProcess) {
    proc.stdout?.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
            writeLog(`[${name}] ${line}`);
        }
    });

    proc.stderr?.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
            writeLog(`[${name}] ERROR: ${line}`);
        }
    });

    proc.on('close', (code) => {
        writeLog(`[${name}] Process exited with code ${code}`);
    });
}

async function main() {
    // Setup log file
    await ensureLogDir();
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    currentLogFile = join(LOG_DIR, `run_${timestamp}.log`);
    console.log(`Logging to ${currentLogFile}`);

    // Cleanup ports
    await writeLog("Cleaning up existing processes...");
    await killProcessesOnPorts([BACKEND_PORT, FRONTEND_PORT, LOG_SERVICE_PORT]);

    // Start Log Service (for the python backend to connect to, if it still depends on it)
    // The python backend uses `log_client` which connects to ws://localhost:9776
    // So we SHOULD start the log service too, or modify backend to be robust without it.
    // The backend `log_client.py` has a try/change to connect, so it shouldn't crash.
    // However, for "python cadquery tasks" and logging, maybe we want it.
    // The user said "combine the logs", so maybe just standard stdout capture is enough if the backend prints to stdout.
    // The python `log_client` prints to console if it can't connect.
    // So we can just capture stdout.

    // Start Backend
    await writeLog("Starting Backend...");
    const backend = spawn('pixi', ['run', 'python', '-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    monitorProcess('BACKEND', backend);

    // Start Frontend
    await writeLog("Starting Frontend...");
    const frontend = spawn('pixi', ['run', 'python', '-m', 'http.server', '8080', '--directory', 'frontend', '--bind', '127.0.0.1'], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    monitorProcess('FRONTEND', frontend);

    // Explicitly tell the user where to go
    console.log('\n===================================================');
    console.log('🚀 Code CAD is running!');
    console.log('👉 Open your browser at: http://localhost:8080');
    console.log('===================================================\n');
    await writeLog("Frontend available at http://localhost:8080");

    const logService = spawn('bun', ['test/log_service.ts'], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    monitorProcess('LOG_SERVICE', logService);


    // Handle shutdown
    const cleanup = () => {
        writeLog("Shutting down...");
        backend.kill();
        frontend.kill();
        logService.kill();

        // On Windows with shell: true, we need taskkill usually
        if (process.platform === 'win32') {
            // We can use the utils function or just rough exec
            // But monitoring process will show exit.
            // spawn('taskkill', ['/F', '/T', '/PID', backend.pid.toString()]);
            // backend.pid might be the shell PID, not the python PID.
            // killProcessesOnPorts handles it better.
        }
        process.exit();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch(console.error);