import { isValidLocalDate } from '../domain';

export type UnknownRecord = Record<string, unknown>;

export function requireRecord(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as UnknownRecord;
}

export function assertExactKeys(
  value: UnknownRecord,
  allowedKeys: readonly string[],
  label: string,
) {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(
      `${label} contains unsupported fields: ${unexpected.join(', ')}.`,
    );
  }
}

export function assertText(
  value: unknown,
  label: string,
  minimumLength: number,
  maximumLength: number,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length < minimumLength ||
    value.length > maximumLength ||
    (minimumLength > 0 && !value.trim())
  ) {
    throw new Error(`${label} is invalid.`);
  }
}

export function assertIso(
  value: unknown,
  label: string,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} is invalid.`);
  }
}

export function assertLocalDate(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== 'string' || !isValidLocalDate(value)) {
    throw new Error(`${label} is invalid.`);
  }
}

export function assertBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} is invalid.`);
}

export function assertFiniteNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
  options: { integer?: boolean; minimumExclusive?: boolean } = {},
): asserts value is number {
  if (typeof value !== 'number') throw new Error(`${label} is invalid.`);
  const belowMinimum = options.minimumExclusive
    ? value <= minimum
    : value < minimum;
  if (
    belowMinimum ||
    !Number.isFinite(value) ||
    value > maximum ||
    (options.integer === true && !Number.isInteger(value))
  ) {
    throw new Error(`${label} is invalid.`);
  }
}

export function assertEnum<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): asserts value is T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} is invalid.`);
  }
}

export function requireArray(
  value: unknown,
  label: string,
  maximumLength: number,
): unknown[] {
  if (!Array.isArray(value) || value.length > maximumLength) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

export function assertNullableIso(value: unknown, label: string) {
  if (value !== null) assertIso(value, label);
}

export function assertNullableText(
  value: unknown,
  label: string,
  maximumLength: number,
) {
  if (value !== null) assertText(value, label, 1, maximumLength);
}

export function assertNullableNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (value !== null) assertFiniteNumber(value, label, minimum, maximum);
}
