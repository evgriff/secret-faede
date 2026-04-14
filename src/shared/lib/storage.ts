function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function readStorageValue(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorageValue(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value);
  } catch {
    // Storage access is optional in this scaffold.
  }
}

export function removeStorageValue(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // Storage access is optional in this scaffold.
  }
}

export function readJsonStorageValue<T>(key: string): T | null {
  const value = readStorageValue(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function writeJsonStorageValue(key: string, value: unknown): void {
  writeStorageValue(key, JSON.stringify(value));
}
