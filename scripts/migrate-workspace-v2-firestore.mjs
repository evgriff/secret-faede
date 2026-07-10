export class FirestoreRestClient {
  constructor(projectId, accessToken) {
    this.accessToken = accessToken;
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  }

  async getOptional(documentPath) {
    return this.request(documentPath, { allowMissing: true });
  }

  async list(collectionPath) {
    const documents = [];
    let pageToken = '';
    do {
      const query = new URLSearchParams({ pageSize: '1000' });
      if (pageToken) query.set('pageToken', pageToken);
      const payload = await this.request(`${collectionPath}?${query}`);
      documents.push(...(payload.documents ?? []));
      pageToken = payload.nextPageToken ?? '';
    } while (pageToken);
    return documents;
  }

  async write(documentPath, data) {
    await this.request(documentPath, {
      body: JSON.stringify({ fields: encodeFields(data) }),
      method: 'PATCH',
    });
  }

  async delete(documentPath) {
    await this.request(documentPath, { allowMissing: true, method: 'DELETE' });
  }

  async request(documentPath, options = {}) {
    const response = await fetch(`${this.base}/${documentPath}`, {
      body: options.body,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      method: options.method ?? 'GET',
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (options.allowMissing && response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `Firestore ${response.status} at ${documentPath}: ${text}`,
      );
    }
    return payload;
  }
}

export function decodeCollection(documents = []) {
  return documents.map((document) => ({
    data: decodeDocument(document),
    id: document?.name?.split('/').pop(),
  }));
}

export function decodeDocument(document) {
  if (!document) return null;
  return Object.fromEntries(
    Object.entries(document.fields ?? {}).map(([key, value]) => [
      key,
      decodeValue(value),
    ]),
  );
}

function decodeValue(value) {
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(decodeValue);
  }
  if ('booleanValue' in value) return value.booleanValue;
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('mapValue' in value) return decodeDocument(value.mapValue);
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  return value;
}

function encodeFields(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, encodeValue(nested)]),
  );
}

function encodeValue(value) {
  if (Array.isArray(value)) {
    return {
      arrayValue: value.length ? { values: value.map(encodeValue) } : {},
    };
  }
  if (value == null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  return { mapValue: { fields: encodeFields(value) } };
}
