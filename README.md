# rollover

[![Current Version](https://img.shields.io/npm/v/rollover.svg)](https://www.npmjs.org/package/rollover)
[![Build Status via Travis CI](https://travis-ci.org/continuationlabs/rollover.svg?branch=master)](https://travis-ci.org/continuationlabs/rollover)
![Dependencies](http://img.shields.io/david/continuationlabs/rollover.svg)
[![belly-button-style](https://img.shields.io/badge/eslint-bellybutton-4B32C3.svg)](https://github.com/continuationlabs/belly-button)


# rollover

`rollover`, is a [hapi](https://github.com/hapijs/hapi) 17+ plugin used for [Rollbar](https://rollbar.com) reporting.

## Basic Usage

```javascript
'use strict';
const Hapi = require('hapi');
const Rollover = require('rollover');
const server = Hapi.server();

await server.register([
  { plugin: Rollover, options: { rollbar: your_rollbar_token } }
]);

server.route([
  {
    method: 'GET',
    path: '/foo',
    handler (request, h) {
      request.log(['log'], 'request.log() -> rollbar.log()');
      request.log(['log', 'error'], 'request.log() -> rollbar.error()');
      throw new Error('throw_err');
    }
  }
]);
```

## Live Testing

By default `rollover`'s test suite mocks calls to the Rollbar service. To make real Rollbar calls in the test suite, use the following command:

```
ROLLOVER_ROLLBAR_TOKEN=your_rollbar_token npm test
```

## Plugin Options

`rollover` supports the following configuration options during plugin registration.

- `rollbar` - Rollbar configuration that is passed directly to the [`Rollbar()`](https://www.npmjs.com/package/rollbar) constructor. This option is required.
- `reportErrorResponses` (Boolean) - When `true`, a hapi `onPreResponse` handler is created which sends `Error` responses to Rollbar. Defaults to `true`.
- `reportRequestLogs` (Boolean) - When `true`, a hapi `'request'` event handler is created which sends `request.log()` data to Rollbar. The Rollbar report level can be controlled via the `request.log()` tags `'critical'`, `'error'`, `'warning'`, `'info'`, and `'debug'`. If none of these tags are provided, Rollbar's default log level is used. Defaults to `true`.
- `reportServerLogs` (Boolean) - When `true`, a hapi server `'log'` event handler is created which sends `server.log()` data to Rollbar. The Rollbar report level can be controlled via the `request.log()` tags `'critical'`, `'error'`, `'warning'`, `'info'`, and `'debug'`. If none of these tags are provided, Rollbar's default log level is used. Defaults to `true`.
- `silenceRollbarLogger` (Boolean) - When `true`, Rollbar's `console` logger is silenced. Defaults to `true`.
- `exposedName` (String) - `rollover` exposes a `Rollbar` instance, making it possible to implement custom usage throughout an application. By default, this instance is exposed on the hapi server as `server.plugins.rollover.rollbar`. This option allows the name to be changed to something other than `rollbar`.
