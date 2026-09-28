import { Buffer } from 'node:buffer';

const cache = new Map<string, Buffer>();
const listeners: Array<() => void> = [];
const timers = new Map<string, NodeJS.Timeout>();
const CACHE_LIMIT = 50;

function snapshot(label: string): void {
  global.gc?.();
  const { rss, heapTotal, heapUsed, external } = process.memoryUsage();
  const mb = (value: number) => Number((value / 1024 / 1024).toFixed(2));
  console.log(label, JSON.stringify({ rss: mb(rss), heapTotal: mb(heapTotal), heapUsed: mb(heapUsed), external: mb(external), cache: cache.size, listeners: listeners.length, timers: timers.size }));
}

function handleRequest(id: string, mode: string): void {
  cache.set(id, Buffer.alloc(64 * 1024));
  if (mode !== 'depois') {
    listeners.push(() => console.log(id));
    if (mode === 'antes') timers.set(id, setInterval(() => { void cache.get(id); }, 1000));
    return;
  }
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function main(): void {
  const mode = process.argv[2];
  if (!['antes', 'sem-timer', 'depois'].includes(mode)) throw new Error('use antes, sem-timer ou depois');
  snapshot('0');
  for (let i = 1; i <= 2000; i++) {
    handleRequest(`req-${i}`, mode);
    if (i % 200 === 0) snapshot(String(i));
  }
  for (const timer of timers.values()) clearInterval(timer);
  timers.clear();
}

if (require.main === module) main();
