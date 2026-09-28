import { AsyncLocalStorage } from 'node:async_hooks';

type Context = { requestId: string };
export const storage = new AsyncLocalStorage<Context>();

function log(level: 'info' | 'error', message: string, error?: unknown): void {
  const entry = {
    level,
    requestId: storage.getStore()?.requestId ?? null,
    message,
    ...(error instanceof Error ? { stack: error.stack } : error === undefined ? {} : { error: String(error) })
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string) => log('info', message),
  error: (message: string, error: unknown) => log('error', message, error)
};
