// Gera as capturas de tela e os quadros do GIF com o painel de verdade aberto no navegador.
// Uso: node scripts/telas.mjs   (precisa de puppeteer-core e do Edge/Chrome)
//   PUPPETEER_DIR  pasta onde puppeteer-core está instalado (padrão: pasta atual)
//   NAVEGADOR      caminho do Edge/Chrome (padrão: Edge do Windows)
// As capturas usam ?hoje=2026-11-24 para o painel mostrar um fim de mês, com alertas de orçamento.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire((process.env.PUPPETEER_DIR ?? process.cwd()).replace(/[\\/]?$/, "/"));
const puppeteer = require("puppeteer-core");
const NAVEGADOR = process.env.NAVEGADOR ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORTA = 3396;
const BASE = `http://localhost:${PORTA}/?hoje=2026-11-24`;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const servidor = spawn(process.execPath, ["scripts/servir.mjs", String(PORTA)], { stdio: "ignore" });
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`http://localhost:${PORTA}/`)).ok) break; } catch { /* aguardando */ }
  await dormir(150);
}

mkdirSync("docs", { recursive: true });
mkdirSync("tmp/quadros", { recursive: true });
const b = await puppeteer.launch({ executablePath: NAVEGADOR, headless: "new" });
const erros = [];
const abrir = async (largura, altura, esquema = "light") => {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: esquema }]);
  await p.setViewport({ width: largura, height: altura, deviceScaleFactor: 1 });
  p.on("pageerror", (e) => erros.push(e.message));
  p.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  await p.goto(BASE, { waitUntil: "networkidle0" });
  await p.waitForSelector(".fatia");
  await dormir(400);
  return p;
};

try {
  // ----- painel completo, claro e escuro
  const p = await abrir(1340, 900);
  await p.screenshot({ path: "docs/painel.png", fullPage: true });
  const escuro = await abrir(1340, 900, "dark");
  await escuro.screenshot({ path: "docs/painel-escuro.png", fullPage: true });
  await escuro.close();

  // ----- novo lançamento
  await p.click("#novo");
  await p.waitForSelector("#l-valor");
  await p.type("#l-valor", "89,90");
  await p.type("#l-desc", "Jantar de aniversário");
  await p.select("#l-cat", "lazer");
  await dormir(300);
  await p.screenshot({ path: "docs/novo-lancamento.png" });
  await p.keyboard.press("Escape");

  // ----- importação de CSV com linhas boas e ruins
  writeFileSync("tmp/extrato.csv", [
    "Data;Descrição;Valor;Categoria",
    "03/11/2026;Cafeteria;-18,50;Alimentação",
    "04/11/2026;Reembolso de viagem;350,00;Outras receitas",
    "05/11/2026;Livro de finanças;-64,90;Educação",
    "31/02/2026;Data impossível;-10;Outros",
    "06/11/2026;Sem valor;;Outros",
  ].join("\n"));
  await p.click("#menu summary");
  await dormir(200);
  await p.click("#menu summary");
  const arquivo = await p.$("#arquivo-csv");
  await arquivo.uploadFile("tmp/extrato.csv");
  await p.waitForSelector(".previa");
  await dormir(300);
  await p.screenshot({ path: "docs/importar-csv.png" });
  await p.keyboard.press("Escape");

  // ----- celular
  const cel = await abrir(390, 800);
  await cel.screenshot({ path: "docs/celular.png", fullPage: true });
  await cel.close();

  // ----- sequência gravada (GIF): adiciona um gasto, filtra pela legenda, vai ao mês anterior e liga o modo escuro
  const g = await abrir(1100, 760);
  const tempos = [];
  let gravando = true;
  const t0 = Date.now();
  const laco = (async () => {
    let n = 0;
    while (gravando) {
      const t = Date.now() - t0;
      await g.screenshot({ path: `tmp/quadros/q${String(n).padStart(4, "0")}.png` });
      tempos.push(t);
      n++;
    }
  })();
  await dormir(1500);
  await g.click("#novo");
  await g.waitForSelector("#l-valor");
  await dormir(400);
  await g.type("#l-valor", "240", { delay: 90 });
  await g.select("#l-cat", "lazer");
  await g.type("#l-desc", "Ingressos do show", { delay: 60 });
  await dormir(500);
  await g.keyboard.press("Enter");
  await dormir(2200);
  await g.click('button.leg[data-cat="lazer"]');
  await dormir(2000);
  await g.evaluate(() => window.scrollTo(0, 0));
  await g.click("#mes-ant");
  await dormir(1600);
  await g.click("#mes-ant");
  await dormir(1600);
  await g.click("#tema");
  await dormir(2000);
  gravando = false;
  await laco;
  writeFileSync("tmp/quadros/tempos.json", JSON.stringify(tempos));
  console.log("quadros:", tempos.length, "duração (s):", ((Date.now() - t0) / 1000).toFixed(1));
  if (erros.length) console.log("ERROS NO NAVEGADOR", erros);
} finally {
  await b.close();
  servidor.kill();
}
