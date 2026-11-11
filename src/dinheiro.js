// Dinheiro sempre em centavos inteiros: nada de ponto flutuante nas contas.

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123456 -> "R$ 1.234,56" */
export function formatarBRL(centavos) {
  return fmt.format((centavos ?? 0) / 100);
}

/** 123456 -> "1.234,56" (sem símbolo, para CSV e campos de edição) */
export function formatarNumero(centavos) {
  return fmtNum.format((centavos ?? 0) / 100);
}

/** 250000 -> "R$ 2,5 mil", 1250000 -> "R$ 12,5 mil", 80000 -> "R$ 800". Para eixos de gráfico. */
export function formatarCompacto(centavos) {
  const v = Math.abs(centavos) / 100;
  const sinal = centavos < 0 ? "-" : "";
  if (v >= 1_000_000) return `${sinal}R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (v >= 1000) return `${sinal}R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sinal}R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

/**
 * Lê um valor digitado ou vindo de planilha e devolve centavos, ou null se não for número.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 12,5", "-3", "1.234" (milhar).
 */
export function lerValor(texto) {
  if (typeof texto === "number") return Number.isFinite(texto) ? Math.round(texto * 100) : null;
  if (typeof texto !== "string") return null;
  let t = texto.replace(/R\$|\s| /gi, "");
  if (!t) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1); }
  if (t.startsWith("-")) { negativo = !negativo; t = t.slice(1); } else if (t.startsWith("+")) t = t.slice(1);
  if (!/^[\d.,]+$/.test(t)) return null;
  const ultimaVirgula = t.lastIndexOf(",");
  const ultimoPonto = t.lastIndexOf(".");
  let inteiro, fracao = "";
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const dec = Math.max(ultimaVirgula, ultimoPonto);
    const bruto = t.slice(0, dec);
    if (!/^\d{1,3}([.,]\d{3})+$/.test(bruto) || bruto.includes(t[dec])) return null; // "1.2.3,4,5" não é número
    inteiro = bruto.replace(/[.,]/g, "");
    fracao = t.slice(dec + 1);
  } else if (ultimaVirgula >= 0) {
    if ((t.match(/,/g) || []).length > 1) return null;
    [inteiro, fracao] = t.split(",");
  } else if (ultimoPonto >= 0) {
    // "1.234" ou "12.345.678" são milhares; "12.5" é decimal
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) inteiro = t.replace(/\./g, "");
    else if ((t.match(/\./g) || []).length > 1) return null;
    else [inteiro, fracao] = t.split(".");
  } else inteiro = t;
  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(fracao) || (!inteiro && !fracao)) return null;
  let centavos = Number(inteiro || "0") * 100 + Number((fracao + "00").slice(0, 2));
  if (fracao.length > 2 && Number(fracao[2]) >= 5) centavos += 1; // arredonda para cima a partir de 5
  if (!Number.isSafeInteger(centavos)) return null;
  return negativo ? -centavos : centavos;
}
