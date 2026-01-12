import { exec } from 'child_process';
import { promisify } from 'util';
import { spawn } from 'child_process';

const execAsync = promisify(exec);

// Function to kill processes on a specific port
export async function killProcessOnPort(port: number): Promise<void> {
    try {
        const isWindows = process.platform === 'win32';
        let stdout: string;
        let pids: Set<string> = new Set();
        
        if (isWindows) {
            // Windows: use netstat and findstr
            const { stdout: netstatOutput } = await execAsync(`netstat -ano | findstr :${port}`);
            stdout = netstatOutput;
            
            if (stdout.trim()) {
                const lines = stdout.trim().split('\n');
                
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 5) {
                        const pid = parts[parts.length - 1];
                        if (pid && pid !== '0') {
                            pids.add(pid);
                        }
                    }
                }
            }
        } else {
            // macOS/Linux: use lsof
            try {
                const { stdout: lsofOutput } = await execAsync(`lsof -ti:${port}`);
                stdout = lsofOutput;
                
                if (stdout.trim()) {
                    const lines = stdout.trim().split('\n');
                    for (const line of lines) {
                        const pid = line.trim();
                        if (pid && pid !== '0') {
                            pids.add(pid);
                        }
                    }
                }
            } catch (lsofError) {
                // lsof might not be available, try netstat as fallback
                try {
                    const { stdout: netstatOutput } = await execAsync(`netstat -tulpn | grep :${port}`);
                    stdout = netstatOutput;
                    
                    if (stdout.trim()) {
                        const lines = stdout.trim().split('\n');
                        for (const line of lines) {
                            const match = line.match(/\s+(\d+)\s*$/);
                            if (match && match[1]) {
                                pids.add(match[1]);
                            }
                        }
                    }
                } catch (netstatError) {
                    console.log(`Could not find processes on port ${port}: ${netstatError}`);
                    return;
                }
            }
        }
        
        // Kill each process
        for (const pid of pids) {
            try {
                if (isWindows) {
                    // First try graceful termination
                    try {
                        await execAsync(`taskkill /PID ${pid}`);
                        console.log(`Gracefully terminated process ${pid} on port ${port}`);
                    } catch (gracefulError) {
                        // If graceful fails, try force kill
                        await execAsync(`taskkill /PID ${pid} /F`);
                        console.log(`Force killed process ${pid} on port ${port}`);
                    }
                } else {
                    await execAsync(`kill -9 ${pid}`);
                    console.log(`Killed process ${pid} on port ${port}`);
                }
            } catch (error) {
                console.log(`Failed to kill process ${pid}: ${error}`);
                // Don't throw here, continue with other processes
            }
        }
        
        // Wait a moment for the port to be released
        if (pids.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        // Silently ignore when no processes are found on the port
        // This is expected behavior when starting a fresh server
    }
}

/**
 * Cross-platform function to kill processes on specified ports
 */
export async function killProcessesOnPorts(ports: number[]): Promise<void> {
    const isWindows = process.platform === 'win32';
    
    for (const port of ports) {
        try {
            if (isWindows) {
                // Windows: Use netstat to find PID, then taskkill to kill it
                await killProcessOnPortWindows(port);
            } else {
                // Linux/macOS: Use lsof to find PID, then kill to terminate it
                await killProcessOnPortUnix(port);
            }
        } catch (error) {
            // Ignore errors - port might not be in use
            console.log(`ℹ️ Port ${port} is not in use or already free`);
        }
    }
}

export async function killProcessOnPortWindows(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        // First, find the process using the port
        const netstat = spawn('netstat', ['-ano'], { shell: true });
        let output = '';
        
        netstat.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        netstat.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`netstat failed with code ${code}`));
                return;
            }
            
            // Parse netstat output to find PID for the port
            const lines = output.split('\n');
            const pidLine = lines.find(line => 
                line.includes(`:${port}`) && 
                line.includes('LISTENING')
            );
            
            if (!pidLine) {
                resolve(); // Port not in use
                return;
            }
            
            // Extract PID from the line
            const parts = pidLine.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            
            if (!pid || isNaN(parseInt(pid))) {
                resolve(); // No valid PID found
                return;
            }
            
            // Kill the process
            const taskkill = spawn('taskkill', ['/F', '/PID', pid], { shell: true });
            
            taskkill.on('close', (killCode) => {
                if (killCode === 0) {
                    console.log(`✅ Killed process ${pid} on port ${port}`);
                } else {
                    console.log(`ℹ️ Process ${pid} on port ${port} was not running or already terminated`);
                }
                resolve();
            });
            
            taskkill.on('error', (error) => {
                console.log(`ℹ️ Could not kill process on port ${port}: ${error.message}`);
                resolve();
            });
        });
        
        netstat.on('error', (error) => {
            reject(error);
        });
    });
}

export async function killProcessOnPortUnix(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        // Use lsof to find the process using the port
        const lsof = spawn('lsof', ['-ti', `:${port}`]);
        let output = '';
        
        lsof.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        lsof.on('close', (code) => {
            if (code !== 0) {
                resolve(); // Port not in use
                return;
            }
            
            const pids = output.trim().split('\n').filter(pid => pid.trim());
            
            if (pids.length === 0) {
                resolve(); // No processes found
                return;
            }
            
            // Kill all processes using the port
            const killPromises = pids.map(pid => {
                return new Promise<void>((killResolve) => {
                    const kill = spawn('kill', ['-9', pid.trim()]);
                    
                    kill.on('close', (killCode) => {
                        if (killCode === 0) {
                            console.log(`✅ Killed process ${pid.trim()} on port ${port}`);
                        } else {
                            console.log(`ℹ️ Process ${pid.trim()} on port ${port} was not running or already terminated`);
                        }
                        killResolve();
                    });
                    
                    kill.on('error', (error) => {
                        console.log(`ℹ️ Could not kill process ${pid.trim()} on port ${port}: ${error.message}`);
                        killResolve();
                    });
                });
            });
            
            Promise.all(killPromises).then(() => resolve());
        });
        
        lsof.on('error', (error) => {
            reject(error);
        });
    });
}
