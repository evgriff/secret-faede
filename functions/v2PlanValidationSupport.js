'use strict';

function addIssue(issues, path, code, message) {
  issues.push({ code, message, path });
}

function validateExactObject(value, path, keys, issues) {
  if (!isRecord(value)) {
    addIssue(issues, path, 'type', 'Must be an object.');
    return false;
  }

  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(
        issues,
        `${path}.${key}`,
        'unexpected-key',
        'Field is not part of schema 9.',
      );
    }
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      addIssue(
        issues,
        `${path}.${key}`,
        'missing-key',
        'Required field is missing.',
      );
    }
  }
  return true;
}

function validateArray(value, path, minimum, maximum, issues) {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'type', 'Must be a list.');
    return false;
  }
  if (value.length < minimum || value.length > maximum) {
    addIssue(
      issues,
      path,
      'list-size',
      `Must contain between ${minimum} and ${maximum} items.`,
    );
  }
  return true;
}

function validateBoolean(value, path, issues) {
  if (typeof value !== 'boolean') {
    addIssue(issues, path, 'type', 'Must be true or false.');
    return false;
  }
  return true;
}

function validateEnum(value, path, allowed, issues) {
  if (!allowed.includes(value)) {
    addIssue(issues, path, 'enum', `Must be one of: ${allowed.join(', ')}.`);
    return false;
  }
  return true;
}

function validateNumber(value, path, minimum, maximum, issues, options = {}) {
  const maximumValid = options.maximumExclusive
    ? value < maximum
    : value <= maximum;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    !maximumValid
  ) {
    addIssue(
      issues,
      path,
      'range',
      `Must be a finite number from ${minimum} ${
        options.maximumExclusive ? 'up to but not including' : 'through'
      } ${maximum}.`,
    );
    return false;
  }
  return true;
}

function validateText(value, path, minimum, maximum, issues) {
  if (
    typeof value !== 'string' ||
    value.length < minimum ||
    value.length > maximum ||
    (minimum > 0 && value.trim().length === 0)
  ) {
    addIssue(
      issues,
      path,
      'text',
      `Must be text between ${minimum} and ${maximum} characters.`,
    );
    return false;
  }
  return true;
}

function validateNullableText(value, path, maximum, issues) {
  if (value === null) return true;
  return validateText(value, path, 1, maximum, issues);
}

function validateIso(value, path, issues) {
  if (!isCanonicalIso(value)) {
    addIssue(
      issues,
      path,
      'iso-instant',
      'Must be a canonical UTC ISO instant with milliseconds.',
    );
    return false;
  }
  return true;
}

function validateNullableLocalDate(value, path, issues) {
  if (value === null) return true;
  if (!isLocalDate(value)) {
    addIssue(
      issues,
      path,
      'local-date',
      'Must be null or a real date in YYYY-MM-DD form.',
    );
    return false;
  }
  return true;
}

function validateMonthDay(value, path, issues) {
  if (!isMonthDay(value)) {
    addIssue(
      issues,
      path,
      'month-day',
      'Must be a real month and day in MM-DD form.',
    );
    return false;
  }
  return true;
}

function validateTimezone(value, path, issues) {
  if (typeof value !== 'string' || !value || value.length > 100) {
    addIssue(issues, path, 'timezone', 'Must be a valid IANA timezone.');
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    addIssue(issues, path, 'timezone', 'Must be a valid IANA timezone.');
    return false;
  }
}

function isCanonicalIso(value) {
  if (typeof value !== 'string' || value.length > 40) return false;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) && instant.toISOString() === value;
}

function isLocalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isMonthDay(value) {
  const match = /^(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  addIssue,
  isCanonicalIso,
  isRecord,
  validateArray,
  validateBoolean,
  validateEnum,
  validateExactObject,
  validateIso,
  validateMonthDay,
  validateNullableLocalDate,
  validateNullableText,
  validateNumber,
  validateText,
  validateTimezone,
};
