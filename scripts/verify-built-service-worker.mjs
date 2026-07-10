import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const workerPath = join(dist, 'firebase-messaging-sw.js');
const legacyWorkerPath = join(dist, 'sw.js');

assert(existsSync(workerPath), 'Missing combined Firebase/PWA service worker.');
assert(!existsSync(legacyWorkerPath), 'Unexpected competing root PWA worker.');

const worker = readFileSync(workerPath, 'utf8');
const registration = [
  readFileSync(join(dist, 'index.html'), 'utf8'),
  readOptional(join(dist, 'registerSW.js')),
].join('\n');

assert(
  registration.includes('firebase-messaging-sw.js'),
  'Built app does not register the combined service worker.',
);
assert(
  !registration.includes('firebase-messaging-sw.js?'),
  'Service-worker registration must not use config query parameters.',
);
assert(
  worker.includes('secret-faeries-precache-'),
  'Combined service worker is missing offline cache handling.',
);
assert(
  worker.includes('Garden alert'),
  'Combined service worker is missing background messaging handling.',
);
assert(
  worker.includes('index.html') && !worker.includes('__WB_MANIFEST'),
  'PWA precache manifest was not injected into the combined worker.',
);

console.log('Combined PWA/background-messaging worker verified.');

function readOptional(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
