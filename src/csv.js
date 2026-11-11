// Importação e exportação de CSV. Exporta no formato que o Excel brasileiro abre direto (ponto e vírgula,
// vírgula decimal, BOM UTF-8) e importa vários formatos de planilha.
import { formatarNumero, lerValor } from "./dinheiro.js";
import { lerData } from "./datas.js";

export const CABECALHO = ["data", "tipo", "categoria", "descricao", "valor"];

const escapar = (c) => (/[;"\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);

/** Neutraliza "injeção de fórmula" em planilhas: texto que começa com = + - @ vira texto. */
const seguro = (t) => (/^[=+\-@\t\r]/.test(t) ? `'${t}` : t);

export function exportarCSV(lancamentos, nomeCategoria) {
  const linhas = [CABECALHO.join(";")];
  const ordenados = [...lancamentos].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.id.localeCompare(b.id)));
  for (const l of ordenados) {
    linhas.push([l.data, l.tipo, seguro(nomeCategoria(l.categoria)), seguro(l.descricao), formatarNumero(l.valor).replace(/\./g, "")].map(escapar).join(";"));
  }
  return "﻿" + linhas.join("\r\n") + "\r\n";
}

/** Separa o texto em linhas de campos respeitando aspas, aspas duplas e quebras de linha dentro do campo. */
export function lerLinhasCSV(texto, delimitador) {
  const linhas = [];
  let campo = "", linha = [], emAspas = false, i = 0;
  const t = texto.replace(/^﻿/, "");
  while (i < t.length) {
    const c = t[i];
    if (emAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i += 2; continue; }
        emAspas = false; i++; continue;
      }
      campo += c; i++; continue;
    }
    if (c === '"' && campo === "") { emAspas = true; i++; continue; }
    if (c === delimitador) { linha.push(campo); campo = ""; i++; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = ""; i++;
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
      linha = [];
      continue;
    }
    campo += c; i++;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
  return linhas;
}

export function detectarDelimitador(texto) {
  const primeira = texto.replace(/^﻿/, "").split(/\r?\n/)[0] ?? "";
  const cont = (d) => (primeira.match(new RegExp(d === "\t" ? "\\t" : "\\" + d, "g")) || []).length;
  return [";", ",", "\t"].map((d) => [d, cont(d)]).sort((a, b) => b[1] - a[1])[0][0] || ";";
}

const sinonimos = {
  data: ["data", "date", "dia"],
  tipo: ["tipo", "type", "natureza"],
  categoria: ["categoria", "category", "grupo"],
  descricao: ["descricao", "descrição", "description", "historico", "histórico", "memo", "nome"],
  valor: ["valor", "amount", "value", "quantia"],
};
const normalizar = (s) => s.trim().toLowerCase();

/**
 * Lê o CSV e devolve { itens, erros }. Cada item: {data, tipo, categoria, descricao, valor}.
 * Sem coluna "tipo", o sinal do valor decide: negativo é despesa, positivo é receita.
 * Linhas ruins viram erros com número da linha e motivo, sem derrubar o resto.
 */
export function importarCSV(texto, { delimitador } = {}) {
  const itens = [], erros = [];
  if (!texto || !texto.trim()) return { itens, erros: [{ linha: 0, motivo: "O arquivo está vazio." }] };
  const delim = delimitador ?? detectarDelimitador(texto);
  const linhas = lerLinhasCSV(texto, delim);
  const cab = linhas[0].map(normalizar);
  const indice = {};
  for (const [campo, nomes] of Object.entries(sinonimos)) indice[campo] = cab.findIndex((c) => nomes.includes(c));
  if (indice.data < 0 || indice.valor < 0) {
    return { itens, erros: [{ linha: 1, motivo: 'O cabeçalho precisa ter pelo menos as colunas "data" e "valor".' }] };
  }
  for (let n = 1; n < linhas.length; n++) {
    const c = linhas[n];
    const num = n + 1;
    const data = lerData(c[indice.data] ?? "");
    if (!data) { erros.push({ linha: num, motivo: `Data inválida: "${(c[indice.data] ?? "").trim()}"` }); continue; }
    let valor = lerValor(c[indice.valor] ?? "");
    if (valor === null || valor === 0) { erros.push({ linha: num, motivo: `Valor inválido: "${(c[indice.valor] ?? "").trim()}"` }); continue; }
    let tipo;
    const bruto = indice.tipo >= 0 ? normalizar(c[indice.tipo] ?? "") : "";
    if (/^(receita|entrada|credito|crédito|income)$/.test(bruto)) tipo = "receita";
    else if (/^(despesa|saida|saída|debito|débito|expense)$/.test(bruto)) tipo = "despesa";
    else if (bruto) { erros.push({ linha: num, motivo: `Tipo desconhecido: "${bruto}" (use receita ou despesa)` }); continue; }
    else tipo = valor < 0 ? "despesa" : "receita";
    valor = Math.abs(valor);
    const desfazer = (t) => t.replace(/^'(?=[=+\-@\t\r])/, "");
    const categoria = desfazer((indice.categoria >= 0 ? c[indice.categoria] ?? "" : "").trim()) || (tipo === "receita" ? "Outras receitas" : "Outros");
    const descricao = desfazer((indice.descricao >= 0 ? c[indice.descricao] ?? "" : "").trim()).slice(0, 120) || categoria;
    itens.push({ data, tipo, categoria: categoria.slice(0, 40), descricao, valor });
  }
  return { itens, erros };
}
