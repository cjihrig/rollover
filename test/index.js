'use strict';

const Barrier = require('cb-barrier');
const Boom = require('boom');
const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const StandIn = require('stand-in');
const Rollover = require('../lib');

// Test shortcuts
const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const { expect } = Code;

const { ROLLOVER_ROLLBAR_TOKEN } = process.env;


describe('Rollover', () => {
  // This test needs to be first, because the default value of
  // silenceRollbarLogger modifies the module cache.
  it('uses the default console if silenceRollbarLogger is false', async () => {
    const server = await createServer({ silenceRollbarLogger: false });
    const { log, error } = server.plugins.rollover.rollbar.client.logger;

    expect(log.name).to.equal('bound bound consoleCall');
    expect(error.name).to.equal('bound bound consoleCall');
  });

  it('reports uncaught errors', async () => {
    const server = await createServer();
    const barrier = checkLog(server, (level, item) => {
      expect(level).to.equal('error');
      expect(item.message).to.not.exist();
      expect(item.err).to.be.an.error(Error, 'throw_err');
      expect(item.custom).to.not.exist();
      expect(item.timestamp).to.be.a.number();
      expect(item.uuid).to.be.a.string();
      expect(item.callback).to.not.exist();
      expect(item.request).to.exist();
      expect(item.request.headers).to.exist();
      expect(item.request.protocol).to.equal('http');
      expect(item.request.url).to.equal('/throw_err');
      expect(item.request.method).to.equal('get');
      expect(item.request.body).to.equal(null);
    });
    const res = await server.inject({ method: 'GET', url: '/throw_err' });

    expect(res.statusCode).to.equal(500);
    return barrier;
  });

  it('reports boom errors', async () => {
    const server = await createServer();
    const barrier = checkLog(server, (level, item) => {
      expect(level).to.equal('error');
      expect(item.message).to.not.exist();
      expect(item.err).to.be.an.error(Error, 'I\'m a teapot');
      expect(item.custom).to.not.exist();
      expect(item.timestamp).to.be.a.number();
      expect(item.uuid).to.be.a.string();
      expect(item.callback).to.not.exist();
      expect(item.request).to.exist();
      expect(item.request.headers).to.exist();
      expect(item.request.protocol).to.equal('http');
      expect(item.request.url).to.equal('/boom');
      expect(item.request.method).to.equal('get');
      expect(item.request.body).to.equal(null);
    });
    const res = await server.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).to.equal(418);
    return barrier;
  });

  it('does not report errors if reportErrorResponses is false', async () => {
    const server = await createServer({ reportErrorResponses: false });
    const barrier = checkLog(server, (level, item) => {
      Code.fail('nothing should be logged');
    });
    const res = await server.inject({ method: 'GET', url: '/throw_err' });

    expect(res.statusCode).to.equal(500);
    setImmediate(() => { barrier.pass(); });
    return barrier;
  });

  it('reports server log calls as info level', async () => {
    const server = await createServer();
    const barrier = checkLog(server, (level, item) => {
      expect(level).to.equal('debug');
      expect(item.message).to.equal('server.log() -> rollbar.log()');
      expect(item.err).to.not.exist();
      expect(item.custom).to.exist();
      expect(item.custom.timestamp).to.be.a.number();
      expect(item.custom.tags).to.equal(['rollbar']);
      expect(item.custom.data).to.equal('server.log() -> rollbar.log()');
      expect(item.custom.channel).to.equal('app');
      expect(item.timestamp).to.be.a.number();
      expect(item.uuid).to.be.a.string();
      expect(item.callback).to.not.exist();
      expect(item.request).to.not.exist();
    });

    server.log(['rollbar'], 'server.log() -> rollbar.log()');
    return barrier;
  });

  it('reports server log calls as error level', async () => {
    const server = await createServer();
    const barrier = checkLog(server, (level, item) => {
      expect(level).to.equal('error');
      expect(item.message).to.equal('server.log() -> rollbar.error()');
      expect(item.err).to.not.exist();
      expect(item.custom).to.exist();
      expect(item.custom.timestamp).to.be.a.number();
      expect(item.custom.tags).to.equal(['rollbar', 'error']);
      expect(item.custom.data).to.equal('server.log() -> rollbar.error()');
      expect(item.custom.channel).to.equal('app');
      expect(item.timestamp).to.be.a.number();
      expect(item.uuid).to.be.a.string();
      expect(item.callback).to.not.exist();
      expect(item.request).to.not.exist();
    });

    server.log(['rollbar', 'error'], 'server.log() -> rollbar.error()');
    return barrier;
  });

  it('does not report server logs if reportServerLogs is false', async () => {
    const server = await createServer({ reportServerLogs: false });
    const barrier = checkLog(server, (level, item) => {
      Code.fail('nothing should be logged');
    });

    server.log(['rollbar'], 'server.log() -> rollbar.log()');
    setImmediate(() => { barrier.pass(); });
    return barrier;
  });

  it('reports request log calls as info level', async () => {
    const server = await createServer();
    const barrier = checkLog(server, (level, item) => {
      expect(level).to.equal('debug');
      expect(item.message).to.equal('request.log() -> rollbar.log()');
      expect(item.err).to.not.exist();
      expect(item.custom).to.exist();
      expect(item.custom.timestamp).to.be.a.number();
      expect(item.custom.tags).to.equal(['rollbar']);
      expect(item.custom.data).to.equal('request.log() -> rollbar.log()');
      expect(item.custom.channel).to.equal('app');
      expect(item.timestamp).to.be.a.number();
      expect(item.uuid).to.be.a.string();
      expect(item.callback).to.not.exist();
      expect(item.request).to.exist();
      expect(item.request.headers).to.exist();
      expect(item.request.protocol).to.equal('http');
      expect(item.request.url).to.equal('/request_log_rollbar');
      expect(item.request.method).to.equal('get');
      expect(item.request.body).to.equal(null);
    });
    const res = await server.inject({ method: 'GET', url: '/request_log_rollbar' });

    expect(res.statusCode).to.equal(200);
    return barrier;
  });

  it('reports request log calls as error level', async () => {
    const server = await createServer();
    const barrier = checkLog(server, (level, item) => {
      expect(level).to.equal('error');

      expect(item.message).to.equal('request.log() -> rollbar.error()');
      expect(item.err).to.not.exist();
      expect(item.custom).to.exist();
      expect(item.custom.timestamp).to.be.a.number();
      expect(item.custom.tags).to.equal(['rollbar', 'error']);
      expect(item.custom.data).to.equal('request.log() -> rollbar.error()');
      expect(item.custom.channel).to.equal('app');
      expect(item.timestamp).to.be.a.number();
      expect(item.uuid).to.be.a.string();
      expect(item.callback).to.not.exist();
      expect(item.request).to.exist();
      expect(item.request.headers).to.exist();
      expect(item.request.protocol).to.equal('http');
      expect(item.request.url).to.equal('/request_error_rollbar');
      expect(item.request.method).to.equal('get');
      expect(item.request.body).to.equal(null);
    });
    const res = await server.inject({ method: 'GET', url: '/request_error_rollbar' });

    expect(res.statusCode).to.equal(200);
    return barrier;
  });

  it('does not report request log if reportRequestLogs is false', async () => {
    const server = await createServer({ reportRequestLogs: false });
    const barrier = checkLog(server, (level, item) => {
      Code.fail('nothing should be logged');
    });
    const res = await server.inject({ method: 'GET', url: '/request_log_rollbar' });

    expect(res.statusCode).to.equal(200);
    setImmediate(() => { barrier.pass(); });
    return barrier;
  });

  it('exposed rollbar allows custom reporting', async () => {
    const server = await createServer();
    const barrier = checkLog(server, (level, item) => {
      expect(level).to.equal('debug');
      expect(item.message).to.equal('custom log data');
      expect(item.err).to.not.exist();
      expect(item.custom).to.not.exist();
      expect(item.timestamp).to.be.a.number();
      expect(item.uuid).to.be.a.string();
      expect(item.callback).to.not.exist();
    });

    expect(server.plugins.rollover.rollbar).to.exist();
    server.plugins.rollover.rollbar.log('custom log data');
    return barrier;
  });

  it('does not report under "normal" circumstances', async () => {
    const server = await createServer();
    const barrier = checkLog(server, (level, item) => {
      Code.fail('nothing should be logged');
    });
    const res = await server.inject({ method: 'GET', url: '/no_reporting' });

    expect(res.statusCode).to.equal(200);
    setImmediate(() => { barrier.pass(); });
    return barrier;
  });

  it('does not report if log level is less than reportLevel', async () => {
    const server = await createServer({
      rollbar: {
        accessToken: ROLLOVER_ROLLBAR_TOKEN,
        reportLevel: 'error'
      }
    });
    const barrier = checkLog(server, (level, item) => {
      Code.fail('nothing should be logged');
    });

    server.log(['rollbar'], 'server.log() -> rollbar.log()');
    setImmediate(() => { barrier.pass(); });
    return barrier;
  });
});


async function createServer (options) {
  const server = Hapi.server();
  const settings = Object.assign({}, { rollbar: ROLLOVER_ROLLBAR_TOKEN || 'test' }, options);

  await server.register([
    { plugin: Rollover, options: settings }
  ]);

  server.route([
    {
      method: 'GET',
      path: '/no_reporting',
      handler (request, h) {
        request.log(['error'], 'request log not reported');
        request.server.log(['error'], 'server log not reported');
        return { result: 'success response' };
      }
    },
    {
      method: 'GET',
      path: '/throw_err',
      handler (request, h) {
        throw new Error('throw_err');
      }
    },
    {
      method: 'GET',
      path: '/boom',
      handler (request, h) {
        return Boom.teapot();
      }
    },
    {
      method: 'GET',
      path: '/request_log_rollbar',
      handler (request, h) {
        request.log(['rollbar'], 'request.log() -> rollbar.log()');
        return 'request_log_rollbar_result';
      }
    },
    {
      method: 'GET',
      path: '/request_error_rollbar',
      handler (request, h) {
        request.log(['rollbar', 'error'], 'request.log() -> rollbar.error()');
        return 'request_error_rollbar_result';
      }
    }
  ]);

  return server;
}


function checkLog (server, check) {
  const barrier = new Barrier();

  const queue = server.plugins.rollover.rollbar.client.notifier.queue;

  StandIn.replace(queue, 'addItem', (stand, item, callback, originalError, originalItem) => {
    stand.restore();

    const predicateResult = queue._applyPredicates(item);

    expect(predicateResult.err).to.not.exist();

    if (!predicateResult.stop) {
      check(item.level, originalItem);
    }

    if (ROLLOVER_ROLLBAR_TOKEN === undefined) {
      barrier.pass();
      return;
    }

    // This module does not use callback, no it is safe to hijack it here.
    function cb (err) {
      expect(err).to.not.exist();
      barrier.pass();
    }

    stand.original.call(queue, item, cb, originalError, originalItem);
  });

  return barrier;
}
