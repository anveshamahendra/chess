"use strict";

// Production by default: `node server.js`. Opt into dev with
// `NODE_ENV=development node server.js`.
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const http = require("node:http");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

function intEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// Slowloris / slow-HTTP hardening -------------------------------------------
// headersTimeout  : full request head must arrive within 10s (Slowloris killer)
// requestTimeout  : full request body must arrive within 30s
// keepAliveTimeout: idle keep-alive sockets are closed after 5s
// socketTimeout   : no bytes at all for 30s closes the socket
const HEADERS_TIMEOUT_MS = intEnv("HEADERS_TIMEOUT_MS", 10_000);
const REQUEST_TIMEOUT_MS = intEnv("REQUEST_TIMEOUT_MS", 30_000);
const KEEP_ALIVE_TIMEOUT_MS = intEnv("KEEP_ALIVE_TIMEOUT_MS", 5_000);
const SOCKET_TIMEOUT_MS = intEnv("SOCKET_TIMEOUT_MS", 30_000);
const MAX_CONN_PER_IP = intEnv("MAX_CONN_PER_IP", 64);
const MAX_CONN_TOTAL = intEnv("MAX_CONN_TOTAL", 0); // 0 = unlimited
// Which peers may speak for other clients via X-Forwarded-For / X-Real-IP.
// "none" = trust nobody (directly exposed server, or local testing of the
// per-IP cap from localhost).
const PROXY_RAW =
  process.env.TRUSTED_PROXIES === undefined
    ? "127.0.0.1,::1"
    : process.env.TRUSTED_PROXIES;
const TRUSTED_PROXIES = new Set(
  /^(none|off|false|0)$/i.test(PROXY_RAW.trim())
    ? []
    : PROXY_RAW.split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
);

function normalizeIp(addr) {
  if (!addr) return "";
  return addr.startsWith("::ffff:") ? addr.slice(7) : addr;
}

function isTrustedProxy(ip) {
  return TRUSTED_PROXIES.has("*") || TRUSTED_PROXIES.has(ip);
}

function refuse(socket) {
  if (!socket.destroyed && socket.writable) {
    socket.end(
      "HTTP/1.1 503 Service Unavailable\r\n" +
        "Connection: close\r\n" +
        "Content-Length: 0\r\n" +
        "\r\n",
    );
  } else {
    socket.destroy();
  }
}

const openPerIp = new Map();

const app = next({ dev });
const handle = app.getRequestHandler();

const server = http.createServer((req, res) => {
  const peer = normalizeIp(req.socket.remoteAddress);
  // Only forwarding headers from a trusted proxy are real. Anything else is
  // client-controlled and would let an attacker rotate X-Forwarded-For to
  // dodge the per-IP rate limits in middleware.ts.
  if (!isTrustedProxy(peer) || !req.headers["x-forwarded-for"]) {
    req.headers["x-forwarded-for"] = peer;
    req.headers["x-real-ip"] = peer;
  }
  handle(req, res);
});

server.headersTimeout = HEADERS_TIMEOUT_MS;
server.requestTimeout = REQUEST_TIMEOUT_MS;
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
server.timeout = SOCKET_TIMEOUT_MS;
// Node reaps header/request timeouts on this interval (default 30s); lower it
// so a slow connection is actually dropped close to headersTimeout.
server.connectionsCheckingInterval = Math.min(1_000, HEADERS_TIMEOUT_MS);
if (MAX_CONN_TOTAL > 0) server.maxConnections = MAX_CONN_TOTAL;

server.on("connection", (socket) => {
  const peer = normalizeIp(socket.remoteAddress);
  // Behind a reverse proxy every socket arrives from the proxy address, so
  // per-IP concurrency is enforced there (nginx limit_conn) instead.
  const behindProxy = isTrustedProxy(peer);
  const key = behindProxy ? null : peer;

  if (key && MAX_CONN_PER_IP > 0) {
    const open = openPerIp.get(key) ?? 0;
    if (open >= MAX_CONN_PER_IP) {
      refuse(socket);
      return;
    }
    openPerIp.set(key, open + 1);
  }

  socket.once("close", () => {
    if (!key) return;
    const open = (openPerIp.get(key) ?? 1) - 1;
    if (open <= 0) openPerIp.delete(key);
    else openPerIp.set(key, open);
  });
});

server.on("clientError", (err, socket) => {
  if (socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  } else {
    socket.destroy();
  }
});

// Next only needs the upgrade channel for dev HMR. No listener in production
// means Node destroys upgrade attempts, so they can't pin a connection open.
if (dev) {
  const upgrade = app.getUpgradeHandler ? app.getUpgradeHandler() : null;
  server.on("upgrade", (req, socket, head) => {
    if (upgrade) upgrade(req, socket, head);
    else socket.destroy();
  });
}

app
  .prepare()
  .then(() => {
    server.listen(port, host, () => {
      console.log(`> Ready on http://${host}:${port} [${process.env.NODE_ENV}]`);
      console.log(
        `> headersTimeout=${HEADERS_TIMEOUT_MS}ms requestTimeout=${REQUEST_TIMEOUT_MS}ms ` +
          `socketTimeout=${SOCKET_TIMEOUT_MS}ms keepAlive=${KEEP_ALIVE_TIMEOUT_MS}ms`,
      );
      console.log(
        `> maxConnPerIp=${MAX_CONN_PER_IP || "unlimited"} ` +
          `maxConnTotal=${MAX_CONN_TOTAL || "unlimited"} ` +
          `trustedProxies=${[...TRUSTED_PROXIES].join(",") || "none"}`,
      );
    });
  })
  .catch((err) => {
    console.error("> failed to start:", err);
    process.exit(1);
  });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3_000).unref();
  });
}
