let DEBUG_MODE = false;

export function setDebugMode(enabled: boolean): void {
  DEBUG_MODE = enabled;
}

export function isDebugMode(): boolean {
  return DEBUG_MODE;
}

export function debugLog(category: string, message: string, data?: unknown): void {
  if (!DEBUG_MODE) return;
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`\x1b[90m[${timestamp}]\x1b[0m \x1b[35m[${category}]\x1b[0m ${message}`);
  if (data !== undefined) {
    console.log('\x1b[90m' + JSON.stringify(data, null, 2) + '\x1b[0m');
  }
}
