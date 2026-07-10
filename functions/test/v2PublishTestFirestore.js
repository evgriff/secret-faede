'use strict';

function createV2PublishTestFirestore(initialDocuments = {}) {
  const documents = new Map(
    Object.entries(initialDocuments).map(([path, value]) => [
      path,
      clone(value),
    ]),
  );
  let autoId = 0;
  let transactionQueue = Promise.resolve();

  const db = {
    collection(name) {
      return collectionRef(String(name));
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
          delete(ref) {
            writes.push(() => documents.delete(ref.path));
          },
          async get(ref) {
            return snapshot(ref, documents.get(ref.path));
          },
          set(ref, value) {
            writes.push(() => documents.set(ref.path, clone(value)));
          },
        };
        const result = await callback(transaction);
        for (const write of writes) write();
        return result;
      });
      transactionQueue = run.catch(() => {});
      return run;
    },
  };

  function collectionRef(path) {
    return {
      doc(id) {
        const resolvedId = id || `auto-${++autoId}`;
        return documentRef(`${path}/${resolvedId}`);
      },
    };
  }

  function documentRef(path) {
    return {
      collection(name) {
        return collectionRef(`${path}/${name}`);
      },
      id: path.split('/').at(-1),
      path,
    };
  }

  return db;
}

function snapshot(ref, value) {
  return {
    data: () => clone(value),
    exists: value !== undefined,
    id: ref.id,
    ref,
  };
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

module.exports = { createV2PublishTestFirestore };
