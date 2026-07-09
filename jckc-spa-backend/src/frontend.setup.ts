import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import type {
  Express,
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

type FrontendFetch = (
  request: globalThis.Request,
) => globalThis.Response | Promise<globalThis.Response>;

type FrontendServerEntry = {
  default?: {
    fetch?: FrontendFetch;
  };
};

type NodeRequestInit = RequestInit & {
  duplex?: 'half';
};

const frontendClientDir = path.resolve(
  __dirname,
  '../../jckc-spa-frontend/dist/client',
);
const frontendServerEntryPath = path.resolve(
  __dirname,
  '../../jckc-spa-frontend/dist/server/server.js',
);

let frontendFetchPromise: Promise<FrontendFetch | null> | null = null;

function hasFrontendBuild(): boolean {
  return existsSync(frontendClientDir) && existsSync(frontendServerEntryPath);
}

function isApiRequest(req: ExpressRequest): boolean {
  return req.path === '/api' || req.path.startsWith('/api/');
}

async function loadFrontendFetch(): Promise<FrontendFetch | null> {
  if (!hasFrontendBuild()) {
    return null;
  }

  frontendFetchPromise ??= import(
    pathToFileURL(frontendServerEntryPath).href
  ).then((entry: FrontendServerEntry) => {
    const fetchHandler = entry.default?.fetch;
    if (typeof fetchHandler !== 'function') {
      throw new Error(
        `Frontend server entry does not export default.fetch: ${frontendServerEntryPath}`,
      );
    }
    return (request: globalThis.Request) => fetchHandler(request);
  });

  return frontendFetchPromise;
}

function toFetchHeaders(req: ExpressRequest): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

function toFetchRequest(req: ExpressRequest): globalThis.Request {
  const host = req.get('host') ?? 'localhost';
  const requestInit: NodeRequestInit = {
    method: req.method,
    headers: toFetchHeaders(req),
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestInit.body = req as unknown as BodyInit;
    requestInit.duplex = 'half';
  }

  return new Request(
    `${req.protocol}://${host}${req.originalUrl}`,
    requestInit,
  );
}

async function sendFetchResponse(
  res: ExpressResponse,
  fetchResponse: globalThis.Response,
  headOnly: boolean,
): Promise<void> {
  res.status(fetchResponse.status);

  const headersWithSetCookie = fetchResponse.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = headersWithSetCookie.getSetCookie?.() ?? [];

  for (const [name, value] of fetchResponse.headers) {
    if (name.toLowerCase() !== 'set-cookie') {
      res.setHeader(name, value);
    }
  }

  for (const cookie of setCookies) {
    res.append('set-cookie', cookie);
  }

  if (headOnly) {
    res.end();
    return;
  }

  res.send(Buffer.from(await fetchResponse.arrayBuffer()));
}

export function mountFrontend(expressApp: Express): void {
  if (!hasFrontendBuild()) {
    return;
  }

  expressApp.use(
    express.static(frontendClientDir, {
      index: false,
      setHeaders(res, filePath) {
        const assetSegment = `${path.sep}assets${path.sep}`;
        if (filePath.includes(assetSegment)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  expressApp.all(
    '/{*splat}',
    async (
      req: ExpressRequest,
      res: ExpressResponse,
      next: NextFunction,
    ): Promise<void> => {
      if (isApiRequest(req)) {
        next();
        return;
      }

      try {
        const fetchHandler = await loadFrontendFetch();
        if (!fetchHandler) {
          next();
          return;
        }

        const fetchResponse = await fetchHandler(toFetchRequest(req));
        await sendFetchResponse(res, fetchResponse, req.method === 'HEAD');
      } catch (error) {
        next(error);
      }
    },
  );
}
