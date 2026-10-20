// Server giả Azure DevOps cho test CLI: ghi lại request, trả JSON theo bảng route.
import http from 'node:http';

// routes: [{ method, match: (pathname, search, rec) => bool, status?, body, contentType? }]
export function startMock(routes) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const u = new URL(req.url, 'http://localhost');
      const rec = {
        method: req.method, path: decodeURIComponent(u.pathname), search: decodeURIComponent(u.search),
        headers: req.headers, body: Buffer.concat(chunks).toString('utf8'),
      };
      requests.push(rec);
      const r = routes.find((x) => (!x.method || x.method === req.method) && x.match(rec.path, rec.search, rec));
      if (!r) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `mock: no route ${req.method} ${req.url}` }));
        return;
      }
      res.writeHead(r.status ?? 200, { 'Content-Type': r.contentType ?? 'application/json' });
      res.end(typeof r.body === 'string' ? r.body : JSON.stringify(r.body));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        port,
        url: `http://127.0.0.1:${port}/EVNCollection`,
        requests,
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
      });
    });
  });
}
