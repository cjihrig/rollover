'use strict';

const Assert = require('assert');
const Rollbar = require('rollbar');

const defaults = {
  exposedName: 'rollbar',
  reportErrorResponses: true,
  reportRequestLogs: true,
  reportServerLogs: true,
  silenceRollbarLogger: true
};


function register (server, options) {
  const settings = Object.assign({}, defaults, options);

  Assert(settings.rollbar);

  if (settings.silenceRollbarLogger) {
    // The rollbar module does some obnoxious logging to the console.
    const logger = require.cache[require.resolve('rollbar/src/server/logger')];

    logger.exports.log = () => {};
    logger.exports.error = () => {};
  }

  const rollbar = new Rollbar(settings.rollbar);
  server.expose(settings.exposedName, rollbar);

  if (settings.reportServerLogs) {
    server.events.on('log', (event, tags) => {
      const level = getLogLevel(tags);

      rollbar[level](event.data || event.error, event);
    });
  }

  if (settings.reportRequestLogs) {
    server.events.on('request', (request, event, tags) => {
      const level = getLogLevel(tags);
      const req = {
        headers: request.headers,
        protocol: request.server.info.protocol,
        url: request.path,
        method: request.method,
        body: request.payload
      };

      rollbar[level](event.data || event.error, req, event);
    });
  }

  if (settings.reportErrorResponses) {
    server.ext('onPreResponse', (request, h) => {
      const response = request.response;

      if (response.isBoom || (response instanceof Error)) {
        rollbar.error(response, {
          headers: request.headers,
          protocol: request.server.info.protocol,
          url: request.path,
          method: request.method,
          body: request.payload
        });
      }

      return h.continue;
    });
  }
}


const LOG_LEVELS = ['critical', 'error', 'warning', 'info', 'debug'];

function getLogLevel (tags) {
  for (let i = 0; i < LOG_LEVELS.length; ++i) {
    const logLevel = LOG_LEVELS[i];

    if (tags[logLevel]) {
      return logLevel;
    }
  }

  return 'log';
}


module.exports = {
  pkg: require('../package.json'),
  register
};
