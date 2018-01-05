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
      if (tags.rollbar) {
        if (tags.error) {
          rollbar.error(event.data, event);
        } else {
          rollbar.log(event.data, event);
        }
      }
    });
  }

  if (settings.reportRequestLogs) {
    server.events.on('request', (request, event, tags) => {
      if (tags.rollbar) {
        const req = {
          headers: request.headers,
          protocol: request.server.info.protocol,
          url: request.path,
          method: request.method,
          body: request.payload
        };

        if (tags.error) {
          rollbar.error(event.data, req, event);
        } else {
          rollbar.log(event.data, req, event);
        }
      }
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


module.exports = {
  pkg: require('../package.json'),
  register
};
