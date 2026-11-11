// Gráficos próprios em SVG (texto puro, sem biblioteca): rosca, barras agrupadas e linhas.
// As cores vêm de classes CSS (.c0 a .c9, .barra-receita...), então temas claro e escuro funcionam sem mexer aqui.
import { formatarBRL, formatarCompacto } from "./dinheiro.js";

export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const n = (v) => Math.round(v * 100) / 100; // coordenadas com no máximo 2 casas

/** Degraus "bonitos" para o eixo: devolve { max, passo } com max múltiplo do passo (1, 2, 2,5, 5 × 10^k). */
export function escalaNice(maximo, divisoes = 4) {
  if (!(maximo > 0)) return { max: 100, passo: 25 };
  const bruto = maximo / divisoes;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / pot;
  const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pot;
  return { max: Math.ceil(maximo / passo) * passo, passo };
}

const ponto = (cx, cy, r, ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];

/** Caminho de uma fatia de rosca entre os ângulos a0 e a1 (radianos, sentido horário). Fatia cheia vira duas metades. */
export function caminhoFatia(cx, cy, R, r, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    const m = a0 + Math.PI;
    return `${caminhoFatia(cx, cy, R, r, a0, m)} ${caminhoFatia(cx, cy, R, r, m, a0 + Math.PI * 2 - 1e-4)}`;
  }
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = ponto(cx, cy, R, a0), [x1, y1] = ponto(cx, cy, R, a1);
  const [x2, y2] = ponto(cx, cy, r, a1), [x3, y3] = ponto(cx, cy, r, a0);
  return `M${n(x0)} ${n(y0)}A${n(R)} ${n(R)} 0 ${grande} 1 ${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}A${n(r)} ${n(r)} 0 ${grande} 0 ${n(x3)} ${n(y3)}Z`;
}

/** Rosca. `dados`: [{rotulo, valor (centavos), cor (0-9, -1 = demais)}]. */
export function rosca({ dados, tamanho = 240, titulo = "Despesas por categoria", rotuloCentro = "Total" }) {
  const itens = dados.filter((d) => d.valor > 0);
  const total = itens.reduce((s, d) => s + d.valor, 0);
  const c = tamanho / 2, R = c - 6, r = R * 0.62;
  const resumo = total ? itens.map((d) => `${d.rotulo}: ${formatarBRL(d.valor)} (${Math.round((d.valor / total) * 100)}%)`).join("; ") : "sem dados";
  let corpo = "";
  if (!total) {
    corpo = `<path class="fatia vazia" d="${caminhoFatia(c, c, R, r, -Math.PI / 2, Math.PI * 1.5)}"><title>Sem dados neste mês</title></path>`;
  } else {
    let ang = -Math.PI / 2;
    for (const d of itens) {
      const sweep = (d.valor / total) * Math.PI * 2;
      const folga = itens.length > 1 ? Math.min(0.012, sweep / 4) : 0; // fresta fina entre fatias
      corpo += `<path class="fatia ${d.cor < 0 ? "c-demais" : "c" + d.cor}" d="${caminhoFatia(c, c, R, r, ang + folga, ang + sweep - folga)}"><title>${esc(d.rotulo)}: ${formatarBRL(d.valor)} (${Math.round((d.valor / total) * 100)}%)</title></path>`;
      ang += sweep;
    }
  }
  return `<svg class="grafico" viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}" role="img" aria-label="${esc(titulo)}. ${esc(resumo)}">
  <title>${esc(titulo)}</title>${corpo}
  <text class="centro-rotulo" x="${c}" y="${n(c - 8)}" text-anchor="middle">${esc(rotuloCentro)}</text>
  <text class="centro-valor" x="${c}" y="${n(c + 16)}" text-anchor="middle">${esc(formatarBRL(total))}</text></svg>`;
}

/** Barras agrupadas por período: `serie` = [{rotulo, a, b}] (por exemplo receitas e despesas). */
export function barras({ serie, largura = 560, altura = 260, nomeA = "Receitas", nomeB = "Despesas", titulo = "Receitas e despesas por mês" }) {
  const m = { e: 62, d: 10, t: 10, b: 28 };
  const w = largura - m.e - m.d, h = altura - m.t - m.b;
  const maxValor = Math.max(0, ...serie.flatMap((s) => [s.a, s.b]));
  const { max, passo } = escalaNice(maxValor);
  const y = (v) => m.t + h - (v / max) * h;
  let grade = "";
  for (let v = 0; v <= max + 1e-6; v += passo) {
    grade += `<line class="grade" x1="${m.e}" x2="${largura - m.d}" y1="${n(y(v))}" y2="${n(y(v))}"/><text class="eixo" x="${m.e - 8}" y="${n(y(v) + 4)}" text-anchor="end">${esc(formatarCompacto(Math.round(v)))}</text>`;
  }
  const grupo = w / Math.max(1, serie.length);
  const larg = Math.max(6, Math.min(30, grupo * 0.32));
  let corpo = "";
  serie.forEach((s, i) => {
    const x0 = m.e + grupo * i + grupo / 2;
    const barra = (v, x, cls, nome) =>
      `<rect class="${cls}" x="${n(x)}" y="${n(y(v))}" width="${n(larg)}" height="${n(Math.max(v > 0 ? 1 : 0, m.t + h - y(v)))}" rx="3"><title>${esc(s.rotulo)}. ${esc(nome)}: ${formatarBRL(v)}</title></rect>`;
    corpo += barra(s.a, x0 - larg - 1.5, "barra-a", nomeA) + barra(s.b, x0 + 1.5, "barra-b", nomeB);
    corpo += `<text class="eixo" x="${n(x0)}" y="${altura - 8}" text-anchor="middle">${esc(s.rotulo)}</text>`;
  });
  const resumo = serie.map((s) => `${s.rotulo}: ${nomeA} ${formatarBRL(s.a)}, ${nomeB} ${formatarBRL(s.b)}`).join("; ");
  return `<svg class="grafico" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="${esc(titulo)}. ${esc(resumo)}"><title>${esc(titulo)}</title>${grade}${corpo}</svg>`;
}

/**
 * Linhas por dia do mês. `series`: [{nome, valores: (centavos|null)[], classe}].
 * `limite`: {valor, rotulo} desenha uma linha horizontal tracejada.
 */
export function linhas({ dias, series, limite = null, largura = 560, altura = 260, titulo = "Gastos acumulados no mês" }) {
  const m = { e: 62, d: 14, t: 12, b: 28 };
  const w = largura - m.e - m.d, h = altura - m.t - m.b;
  const maxValor = Math.max(0, limite?.valor ?? 0, ...series.flatMap((s) => s.valores.filter((v) => v !== null)));
  const { max, passo } = escalaNice(maxValor);
  const x = (dia) => m.e + (dias <= 1 ? 0 : ((dia - 1) / (dias - 1)) * w);
  const y = (v) => m.t + h - (v / max) * h;
  let grade = "";
  for (let v = 0; v <= max + 1e-6; v += passo) {
    grade += `<line class="grade" x1="${m.e}" x2="${largura - m.d}" y1="${n(y(v))}" y2="${n(y(v))}"/><text class="eixo" x="${m.e - 8}" y="${n(y(v) + 4)}" text-anchor="end">${esc(formatarCompacto(Math.round(v)))}</text>`;
  }
  const marcas = [...new Set([1, 5, 10, 15, 20, 25, dias].filter((d) => d <= dias))];
  for (const d of marcas) grade += `<text class="eixo" x="${n(x(d))}" y="${altura - 8}" text-anchor="middle">${d}</text>`;
  let corpo = "";
  if (limite && limite.valor > 0) {
    corpo += `<line class="limite" x1="${m.e}" x2="${largura - m.d}" y1="${n(y(limite.valor))}" y2="${n(y(limite.valor))}"/><text class="limite-rotulo" x="${largura - m.d - 4}" y="${n(y(limite.valor) - 6)}" text-anchor="end">${esc(limite.rotulo)}</text>`;
  }
  for (const s of series) {
    let d = "", aberto = false, ultimo = null;
    s.valores.forEach((v, i) => {
      if (v === null) { aberto = false; return; }
      d += `${aberto ? "L" : "M"}${n(x(i + 1))} ${n(y(v))}`;
      aberto = true;
      ultimo = [i + 1, v];
    });
    if (d) corpo += `<path class="linha ${s.classe}" d="${d}" fill="none"/>`;
    if (ultimo && s.marcador) corpo += `<circle class="ponta ${s.classe}" cx="${n(x(ultimo[0]))}" cy="${n(y(ultimo[1]))}" r="4.5"><title>${esc(s.nome)}, dia ${ultimo[0]}: ${formatarBRL(ultimo[1])}</title></circle>`;
  }
  // áreas sensíveis ao toque/mouse para dica de cada dia
  const passoX = dias <= 1 ? w : w / (dias - 1);
  for (let dia = 1; dia <= dias; dia++) {
    const partes = series.filter((s) => s.valores[dia - 1] !== null && s.valores[dia - 1] !== undefined).map((s) => `${s.nome}: ${formatarBRL(s.valores[dia - 1])}`);
    if (partes.length) corpo += `<rect class="dica" x="${n(x(dia) - passoX / 2)}" y="${m.t}" width="${n(passoX)}" height="${h}"><title>Dia ${dia}. ${esc(partes.join(" · "))}</title></rect>`;
  }
  const resumo = series.map((s) => { const v = [...s.valores].reverse().find((x) => x !== null); return `${s.nome}: ${v === undefined ? "sem dados" : formatarBRL(v)}`; }).join("; ");
  return `<svg class="grafico" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="${esc(titulo)}. Último valor de cada série. ${esc(resumo)}"><title>${esc(titulo)}</title>${grade}${corpo}</svg>`;
}
