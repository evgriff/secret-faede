'use strict';

const dayMs = 24 * 60 * 60 * 1000;
const defaultLocation = {
  latitude: 42.3314,
  locationName: 'Detroit, MI',
  longitude: -83.0458,
  timezone: 'America/Detroit',
};

function isUserDueForWateringCheck(
  profile,
  now = new Date(),
  windowMinutes = 70,
) {
  const preference = profile?.notificationPreference || {};
  const timezone =
    preference.timezone || profile?.timezone || defaultLocation.timezone;
  const targetMinutes = parseLocalTime(
    preference.defaultWateringCheckTime || '07:00',
  );
  const elapsedMinutes =
    (getLocalMinutes(now, timezone) - targetMinutes + 1440) % 1440;

  return elapsedMinutes < windowMinutes;
}

function getGardenLocation(garden, profile) {
  const location = garden?.plot?.location || {};

  return {
    latitude: toNumber(location.latitude, defaultLocation.latitude),
    locationName:
      location.locationName ||
      profile?.climateProfile?.locationName ||
      defaultLocation.locationName,
    longitude: toNumber(location.longitude, defaultLocation.longitude),
    timezone:
      location.timezone || profile?.timezone || defaultLocation.timezone,
  };
}

function getGardenTimezone(garden) {
  return garden?.plot?.location?.timezone || defaultLocation.timezone;
}

function formatLocalDate(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);

  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

function getLocalMinutes(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: timezone,
  }).formatToParts(date);
  const hour = Number(part(parts, 'hour')) % 24;
  const minute = Number(part(parts, 'minute'));

  return hour * 60 + minute;
}

function parseLocalTime(value) {
  const [hour = '7', minute = '0'] = String(value).split(':');
  return Number(hour) * 60 + Number(minute);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  return new Date(date.getTime() + days * dayMs).toISOString().slice(0, 10);
}

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const leftDate = left.dueDate || '9999-12-31';
    const rightDate = right.dueDate || '9999-12-31';

    return leftDate === rightDate
      ? left.title.localeCompare(right.title)
      : leftDate.localeCompare(rightDate);
  });
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function part(parts, type) {
  return parts.find((entry) => entry.type === type)?.value || '00';
}

module.exports = {
  addDays,
  defaultLocation,
  formatLocalDate,
  getGardenLocation,
  getGardenTimezone,
  isUserDueForWateringCheck,
  roundTo,
  sortTasks,
};
