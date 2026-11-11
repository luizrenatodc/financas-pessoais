// Servidor estático mínimo para ver o painel localmente: node scripts/servir.mjs [porta]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..");
const porta = Number(process.argv[2] ?? process.env.PORT ?? 3000);
const tipos = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif" };

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const rel = normalize(caminho === "/" ? "/index.html" : caminho).replace(/^([/\\])+/, "");
  const arquivo = join(raiz, rel);
  if (!arquivo.startsWith(raiz) || /(^|[/\\])(\.git|node_modules|test|scripts)([/\\]|$)/.test(rel)) return res.writeHead(403).end();
  try {
    const dados = await readFile(arquivo);
    res.writeHead(200, { "content-type": tipos[extname(arquivo)] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(dados);
  } catch {
    res.writeHead(404).end("Não encontrado");
  }
}).listen(porta, () => console.log(`Finanças em http://localhost:${porta}`));
