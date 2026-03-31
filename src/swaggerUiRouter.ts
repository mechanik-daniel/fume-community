/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */

import express, { type Response } from 'express';

import {
  swaggerUiBundleJs,
  swaggerUiCss,
  swaggerUiFavicon16x16PngBase64,
  swaggerUiFavicon32x32PngBase64,
  swaggerUiStandalonePresetJs,
} from './swaggerUiAssets.generated';

type SwaggerUiRouterOptions = {
  swaggerJsonUrl: string;
  title?: string;
};

type SwaggerUiAsset = {
  body: Buffer | string;
  contentType: string;
};

const SWAGGER_UI_ASSET_CACHE_CONTROL = 'public, max-age=86400';

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const createSwaggerUiHtml = ({ swaggerJsonUrl, title }: SwaggerUiRouterOptions): string => {
  const documentTitle = title && title.trim() !== '' ? title.trim() : 'Swagger UI';
  const escapedTitle = escapeHtml(documentTitle);
  const serializedSwaggerJsonUrl = JSON.stringify(swaggerJsonUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  <link rel="stylesheet" type="text/css" href="/api-docs/swagger-ui.css" />
  <link rel="icon" type="image/png" href="/api-docs/favicon-32x32.png" sizes="32x32" />
  <link rel="icon" type="image/png" href="/api-docs/favicon-16x16.png" sizes="16x16" />
  <style>
    html {
      box-sizing: border-box;
      overflow-y: scroll;
    }

    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }

    body {
      margin: 0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api-docs/swagger-ui-bundle.js" charset="utf-8"></script>
  <script src="/api-docs/swagger-ui-standalone-preset.js" charset="utf-8"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: ${serializedSwaggerJsonUrl},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: 'StandaloneLayout'
      });
    };
  </script>
</body>
</html>`;
};

const swaggerUiAssets = Object.freeze<Record<string, SwaggerUiAsset>>({
  'swagger-ui.css': {
    body: swaggerUiCss,
    contentType: 'text/css; charset=utf-8'
  },
  'swagger-ui-bundle.js': {
    body: swaggerUiBundleJs,
    contentType: 'application/javascript; charset=utf-8'
  },
  'swagger-ui-standalone-preset.js': {
    body: swaggerUiStandalonePresetJs,
    contentType: 'application/javascript; charset=utf-8'
  },
  'favicon-32x32.png': {
    body: Buffer.from(swaggerUiFavicon32x32PngBase64, 'base64'),
    contentType: 'image/png'
  },
  'favicon-16x16.png': {
    body: Buffer.from(swaggerUiFavicon16x16PngBase64, 'base64'),
    contentType: 'image/png'
  }
});

const sendSwaggerUiAsset = (res: Response, asset: SwaggerUiAsset) => {
  const bodyLength = typeof asset.body === 'string' ? Buffer.byteLength(asset.body, 'utf8') : asset.body.byteLength;
  res.set('Cache-Control', SWAGGER_UI_ASSET_CACHE_CONTROL);
  res.set('Content-Length', bodyLength.toString());
  res.set('Content-Type', asset.contentType);
  res.set('X-Content-Type-Options', 'nosniff');
  res.status(200).send(asset.body);
};

export const createSwaggerUiRouter = (options: SwaggerUiRouterOptions) => {
  const router = express.Router();
  const html = createSwaggerUiHtml(options);

  router.get('/', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').status(200).send(html);
  });

  router.get('/:assetName', (req, res) => {
    const assetName = req.params.assetName;
    const asset = assetName ? swaggerUiAssets[assetName] : undefined;

    if (!asset) {
      res.status(404).json({ message: 'not found' });
      return;
    }

    sendSwaggerUiAsset(res, asset);
  });

  return router;
};