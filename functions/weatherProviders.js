'use strict';

const { NationalWeatherServiceProvider } = require('./nwsWeatherProvider');
const { TomorrowIoProvider } = require('./tomorrowWeatherProvider');

function createBackendWeatherProvider(logger) {
  const nws = new NationalWeatherServiceProvider(logger);
  const tomorrowEnabled =
    process.env.ENABLE_TOMORROW_WEATHER === 'true' ||
    process.env.TOMORROW_WEATHER_ENABLED === 'true';

  if (tomorrowEnabled && process.env.TOMORROW_API_KEY) {
    logger.info('Weather provider selected', {
      fallbackProviderId: nws.id,
      providerId: 'tomorrowIo',
      reason: 'Tomorrow.io enabled by environment; NWS remains fallback.',
    });
    return new TomorrowIoProvider(process.env.TOMORROW_API_KEY, nws, logger);
  }

  logger.info('Weather provider selected', {
    providerId: nws.id,
    reason: 'NWS is the default U.S. weather provider.',
  });
  return nws;
}

module.exports = {
  createBackendWeatherProvider,
};
