/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */
import { describe, expect, test } from '@jest/globals';
import request from 'supertest';

const getDocsHtmlResponse = async () => {
  const first = await request(globalThis.app).get('/api-docs');

  if (first.status >= 300 && first.status < 400 && typeof first.headers.location === 'string') {
    return request(globalThis.app).get(first.headers.location);
  }

  return first;
};

describe('OpenAPI and docs routes', () => {
  test('GET /api-docs/swagger.json returns the OpenAPI spec (with injected version)', async () => {
    // Jest runs these integration tests in a CommonJS context (via Babel transform)
    // so using `require()` here avoids relying on `import.meta`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { version } = require('../../package.json') as { version: string };

    const res = await request(globalThis.app)
      .get('/api-docs/swagger.json')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toBeTruthy();
    expect(res.body.openapi).toBe('3.0.3');

    expect(res.body.info).toBeTruthy();
    expect(res.body.info.title).toBe('FUME Community API');
    expect(res.body.info.version).toBe(version);

    // Basic shape sanity checks
    expect(typeof res.body.paths).toBe('object');
    expect(res.body.paths).toBeTruthy();
  });

  test('GET /api-docs responds with HTML that only references the expected docs assets', async () => {
    const res = await getDocsHtmlResponse();

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/i);
    expect(typeof res.text).toBe('string');
    expect(res.text).toMatch(/<!doctype html>|<html/i);

    const referencedDocsPaths = Array.from(res.text.matchAll(/\/api-docs\/[A-Za-z0-9._-]+/g), ([match]) => match);

    expect(new Set(referencedDocsPaths)).toEqual(new Set([
      '/api-docs/swagger.json',
      '/api-docs/swagger-ui.css',
      '/api-docs/swagger-ui-bundle.js',
      '/api-docs/swagger-ui-standalone-preset.js',
      '/api-docs/favicon-32x32.png',
      '/api-docs/favicon-16x16.png'
    ]));
  });

  test.each([
    ['/api-docs/swagger-ui.css', /text\/css/i, /^\.swagger-ui\b/m],
    ['/api-docs/swagger-ui-bundle.js', /javascript/i, /SwaggerUIBundle/],
    ['/api-docs/swagger-ui-standalone-preset.js', /javascript/i, /SwaggerUIStandalonePreset/]
  ])('GET %s serves the required Swagger UI asset', async (path, contentType, bodyPattern) => {
    const res = await request(globalThis.app)
      .get(path)
      .expect(200)
      .expect('Content-Type', contentType);

    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.text).toMatch(bodyPattern);
  });

  test('GET /api-docs/does-not-exist.js returns 404', async () => {
    const res = await request(globalThis.app)
      .get('/api-docs/does-not-exist.js')
      .expect(404)
      .expect('Content-Type', /json/);

    expect(res.body).toEqual({ message: 'not found' });
  });
});
