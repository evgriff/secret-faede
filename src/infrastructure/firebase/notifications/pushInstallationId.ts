const STORAGE_KEY = 'secret-faeries.push-installation-id';

let memoryInstallationId: string | null = null;

export async function getPushInstallationId(): Promise<string> {
  const native = await isNativePlatform();

  if (native) {
    const nativeId = await readNativeInstallationId();
    if (nativeId) return nativeId;
  } else {
    const browserId = readBrowserInstallationId();
    if (browserId) return browserId;
  }

  const installationId = createInstallationId();
  memoryInstallationId = installationId;

  if (native) {
    await writeNativeInstallationId(installationId);
  } else {
    writeBrowserInstallationId(installationId);
  }

  return installationId;
}

async function isNativePlatform() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function readNativeInstallationId() {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const result = await Preferences.get({ key: STORAGE_KEY });
    const installationId = normalizeInstallationId(result.value);
    if (installationId) memoryInstallationId = installationId;
    return installationId ?? memoryInstallationId;
  } catch {
    return memoryInstallationId;
  }
}

async function writeNativeInstallationId(installationId: string) {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: STORAGE_KEY, value: installationId });
  } catch {
    // The in-memory value still keeps this app session internally consistent.
  }
}

function readBrowserInstallationId() {
  try {
    const installationId = normalizeInstallationId(
      globalThis.localStorage?.getItem(STORAGE_KEY),
    );
    if (installationId) memoryInstallationId = installationId;
    return installationId ?? memoryInstallationId;
  } catch {
    return memoryInstallationId;
  }
}

function writeBrowserInstallationId(installationId: string) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, installationId);
  } catch {
    // The in-memory value still keeps this app session internally consistent.
  }
}

function normalizeInstallationId(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized.length >= 16 && normalized.length <= 128
    ? normalized
    : null;
}

function createInstallationId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}
