// Builds the Fastify app. The caller owns listen and close.
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { CONTENT_LIMIT_BYTES } from '../../shared/contract.js';
import { addAuthGate } from './auth/gate.js';
import { documentRoutes } from './documents/routes.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { addSecurityHeaders, securityHeaders } from './security-headers.js';
import { settingsRoutes } from './settings/routes.js';

const defaultWebRoot = fileURLToPath(new URL('../../dist/web', import.meta.url));
// A page for a browser that asked for a page and got an error, so it never
// shows a raw JSON body. It uses only public files.
const errorPage = (text) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Margin</title>
<script src="/theme-init.js"></script>
<link rel="stylesheet" href="/styles.css">
</head>
<body class="login-page">
<main class="login-card">
<h1>Margin</h1>
<p>${text}</p>
<p><a href="/">Open Margin</a></p>
</main>
</body>
</html>
`;
/** True for a browser page load outside /api/, which shows the reply as a page. */
const wantsPage = (request) =>
  (request.method === 'GET' || request.method === 'HEAD') &&
  !request.url.startsWith('/api/') &&
  Boolean(request.headers.accept?.includes('text/html'));

const redact = {
  paths: ['headers.cookie', 'headers.authorization', '*.headers.cookie', '*.headers.authorization'],
  censor: '[redacted]',
};

/**
 * @param {object} options
 * @param {import('./config.js').Config} options.config
 * @param {import('node:sqlite').DatabaseSync} options.db
 * @param {() => number} [options.clock] Returns Unix ms. Tests inject it.
 * @param {false | object} [options.logger] `false` turns logging off. An object adds Fastify logger options.
 * @param {string} [options.webRoot] Folder with the built frontend.
 */
export async function buildApp({ config, db, clock = Date.now, logger, webRoot = defaultWebRoot }) {
  const app = Fastify({
    trustProxy: true,
    logger: logger === false ? false : { redact, ...logger },
    // Malformed URLs never reach the router or the onSend hook, so this reply
    // sets the security headers itself.
    frameworkErrors: (error, request, reply) => {
      reply.code(400).headers(securityHeaders(config.isProduction));
      if (wantsPage(request)) return reply.type('text/html; charset=utf-8').send(errorPage('This address is not valid.'));
      return reply.send({ error: 'bad_request' });
    },
  });

  // Every route, including plugin routes, for the gate sweep test.
  const routes = [];
  app.decorate('registeredRoutes', routes);
  app.addHook('onRoute', ({ method, url }) => routes.push({ method, url }));

  // Every error body is { error: "<code>" } (section 2.7), including the
  // errors Fastify raises while it parses a body.
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status === 413) return reply.code(413).send({ error: 'too_large', limitBytes: CONTENT_LIMIT_BYTES });
    if (status === 415) return reply.code(415).send({ error: 'unsupported_media_type' });
    if (status >= 400 && status < 500) return reply.code(status).send({ error: 'bad_request' });
    request.log.error(error);
    reply.code(500);
    if (wantsPage(request)) return reply.type('text/html; charset=utf-8').send(errorPage('Something went wrong. Reload the page to try again.'));
    return reply.send({ error: 'internal_error' });
  });
  // Unknown routes and missing static files, which @fastify/static hands on.
  app.setNotFoundHandler((request, reply) => {
    reply.code(404);
    if (wantsPage(request)) return reply.type('text/html; charset=utf-8').send(errorPage('This page does not exist.'));
    return reply.send({ error: 'not_found' });
  });

  // Awaited so its cookie parser runs before the gate hook below.
  await app.register(fastifyCookie);
  addSecurityHeaders(app, config);
  addAuthGate(app, { db, clock });

  // Chunk names hold a content hash, so a chunk never changes. The browser
  // keeps it, which saves a check per chunk on each page load. Other files
  // revalidate each time. All are private: most need a session, so a shared
  // cache must never keep one (audit C4).
  const chunks = resolve(webRoot, 'chunks') + sep;
  app.register(fastifyStatic, {
    root: webRoot,
    cacheControl: false,
    setHeaders: (reply, path) => {
      reply.header('cache-control', path.startsWith(chunks) ? 'private, max-age=31536000, immutable' : 'private, no-cache');
    },
  });
  app.get('/login', (request, reply) => reply.sendFile('login.html'));
  app.register(healthRoutes);
  app.register(authRoutes, { db, config, clock });
  app.register(documentRoutes, { db, clock });
  app.register(settingsRoutes, { db });
  return app;
}
