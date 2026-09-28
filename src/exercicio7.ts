import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from './app-error';

export async function readConfig(path: string): Promise<unknown> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content) as unknown;
  } catch (error: unknown) {
    console.error('falha ao ler config:', error); 
    if (isMissingFile(error)) throw new AppError('configuração não encontrada', 404);
    throw error; 
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function retryLater(): Promise<void> {
  await new Promise<void>((_resolve, reject) => {
    setTimeout(() => reject(new Error('tentativa de releitura falhou')), 200);
  });
}

export async function fetchChecked(url: string): Promise<unknown> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new AppError(`HTTP ${response.status}`, response.status);
    return await response.json() as unknown;
  } catch (error: unknown) {
    console.error('falha no fetch:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const base = await fs.mkdtemp(join(tmpdir(), 'ex7-'));
  const valid = `${base}/valid.json`;
  const invalid = `${base}/invalid.json`;
  await fs.writeFile(valid, '{"modo":"teste"}');
  await fs.writeFile(invalid, '{invalido}');
  const server = createServer((_req, res) => { res.writeHead(404); res.end('não existe'); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('porta indisponível');

  try {
    console.log('válido:', JSON.stringify(await readConfig(valid)));
    for (const [label, task] of [
      ['ausente', () => readConfig(`${base}/missing.json`)],
      ['JSON inválido', () => readConfig(invalid)],
      ['timer', retryLater],
      ['rede', () => fetchChecked('http://host-que-nao-existe.invalid/')],
      ['HTTP 404', () => fetchChecked(`http://127.0.0.1:${address.port}/`)]
    ] as const) {
      try { await task(); }
      catch (error: unknown) {
        console.log(`${label}:`, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
      }
    }
  } finally {
    server.close();
    await fs.rm(base, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
