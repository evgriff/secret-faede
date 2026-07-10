'use strict';

function createMemoryFirestore(initialDocuments = {}) {
  const documents = new Map(
    Object.entries(initialDocuments).map(([path, value]) => [
      normalizePath(path),
      clone(value),
    ]),
  );
  let transactionQueue = Promise.resolve();

  const db = {
    collection(name) {
      return createCollectionRef(db, documents, normalizePath(name));
    },
    dump() {
      return Object.fromEntries(
        [...documents.entries()].map(([path, value]) => [path, clone(value)]),
      );
    },
    runTransaction(callback) {
      const run = transactionQueue.then(async () => {
        const writes = [];
        const transaction = {
          async get(ref) {
            return ref.get();
          },
          set(ref, value, options) {
            writes.push(() => ref.set(value, options));
          },
        };
        const result = await callback(transaction);

        for (const write of writes) {
          await write();
        }

        return result;
      });
      transactionQueue = run.catch(() => {});
      return run;
    },
  };

  return db;
}

function createCollectionRef(db, documents, path) {
  return {
    doc(id) {
      return createDocumentRef(db, documents, `${path}/${id}`);
    },
    async get() {
      const prefix = `${path}/`;
      const docs = [...documents.entries()]
        .filter(([documentPath]) => {
          if (!documentPath.startsWith(prefix)) {
            return false;
          }

          return !documentPath.slice(prefix.length).includes('/');
        })
        .map(([documentPath, value]) =>
          createSnapshot(createDocumentRef(db, documents, documentPath), value),
        );

      return { docs, size: docs.length };
    },
  };
}

function createDocumentRef(db, documents, path) {
  const normalizedPath = normalizePath(path);
  const id = normalizedPath.split('/').at(-1);
  const ref = {
    id,
    path: normalizedPath,
    collection(name) {
      return createCollectionRef(db, documents, `${normalizedPath}/${name}`);
    },
    async delete() {
      documents.delete(normalizedPath);
    },
    async get() {
      return createSnapshot(ref, documents.get(normalizedPath));
    },
    async set(value, options = {}) {
      const current = documents.get(normalizedPath);
      documents.set(
        normalizedPath,
        options.merge && current
          ? deepMerge(current, clone(value))
          : clone(value),
      );
    },
  };

  return ref;
}

function createSnapshot(ref, value) {
  return {
    data: () => (value === undefined ? undefined : clone(value)),
    exists: value !== undefined,
    id: ref.id,
    ref,
  };
}

function deepMerge(target, source) {
  if (!isRecord(target) || !isRecord(source)) {
    return clone(source);
  }

  const result = { ...clone(target) };

  for (const [key, value] of Object.entries(source)) {
    result[key] =
      isRecord(value) && isRecord(result[key])
        ? deepMerge(result[key], value)
        : clone(value);
  }

  return result;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function normalizePath(path) {
  return String(path)
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

module.exports = { createMemoryFirestore };
