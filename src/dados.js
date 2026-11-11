// Formato dos dados, categorias padrão, armazenamento no navegador e criação de itens.
import { dataValida } from "./datas.js";

export const VERSAO = 1;
export const CHAVE = "financas.v1";

export const CATEGORIAS_PADRAO = [
  { id: "moradia", nome: "Moradia", tipo: "despesa", cor: 0 },
  { id: "alimentacao", nome: "Alimentação", tipo: "despesa", cor: 1 },
  { id: "transporte", nome: "Transporte", tipo: "despesa", cor: 2 },
  { id: "saude", nome: "Saúde", tipo: "despesa", cor: 3 },
  { id: "lazer", nome: "Lazer", tipo: "despesa", cor: 4 },
  { id: "educacao", nome: "Educação", tipo: "despesa", cor: 5 },
  { id: "assinaturas", nome: "Assinaturas", tipo: "despesa", cor: 6 },
  { id: "compras", nome: "Compras", tipo: "despesa", cor: 7 },
  { id: "outros", nome: "Outros", tipo: "despesa", cor: 8 },
  { id: "salario", nome: "Salário", tipo: "receita", cor: 0 },
  { id: "freelance", nome: "Freelance", tipo: "receita", cor: 1 },
  { id: "investimentos", nome: "Investimentos", tipo: "receita", cor: 2 },
  { id: "outras-receitas", nome: "Outras receitas", tipo: "receita", cor: 3 },
];

export const dadosVazios = () => ({
  versao: VERSAO,
  exemplo: false,
  categorias: CATEGORIAS_PADRAO.map((c) => ({ ...c })),
  lancamentos: [],
  orcamentos: {},
  metas: [],
});

let contador = 0;
export function novoId() {
  const aleatorio = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${(contador++ % 1296).toString(36).padStart(2, "0")}${aleatorio}`;
}

export const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "categoria";

/** Acha a categoria pelo nome (sem diferenciar maiúsculas nem acentos) ou cria uma nova. Devolve o id. */
export function garantirCategoria(dados, nome, tipo) {
  const alvo = slug(nome);
  const existente = dados.categorias.find((c) => slug(c.nome) === alvo && c.tipo === tipo) ?? dados.categorias.find((c) => slug(c.nome) === alvo);
  if (existente) return existente.id;
  let id = alvo, i = 2;
  while (dados.categorias.some((c) => c.id === id)) id = `${alvo}-${i++}`;
  const cor = dados.categorias.filter((c) => c.tipo === tipo).length % 10;
  dados.categorias.push({ id, nome: nome.trim().slice(0, 40), tipo, cor });
  return id;
}

export function validarLancamento(l) {
  const erros = [];
  if (l.tipo !== "receita" && l.tipo !== "despesa") erros.push("Escolha receita ou despesa.");
  if (!Number.isInteger(l.valor) || l.valor <= 0) erros.push("Informe um valor maior que zero.");
  if (!dataValida(l.data)) erros.push("Informe uma data válida.");
  if (!l.categoria) erros.push("Escolha uma categoria.");
  if (!String(l.descricao ?? "").trim()) erros.push("Descreva o lançamento.");
  return erros;
}

/** Confere o que veio do armazenamento: descarta o que está quebrado em vez de travar o painel. */
export function sanear(bruto) {
  if (!bruto || typeof bruto !== "object") return null;
  const base = dadosVazios();
  const categorias = Array.isArray(bruto.categorias)
    ? bruto.categorias.filter((c) => c && typeof c.id === "string" && typeof c.nome === "string" && (c.tipo === "receita" || c.tipo === "despesa")).map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo, cor: Number.isInteger(c.cor) ? c.cor : 0 }))
    : base.categorias;
  const ids = new Set(categorias.map((c) => c.id));
  const lancamentos = (Array.isArray(bruto.lancamentos) ? bruto.lancamentos : [])
    .filter((l) => l && typeof l.id === "string" && ids.has(l.categoria) && validarLancamento(l).length === 0)
    .map((l) => ({ id: l.id, tipo: l.tipo, valor: l.valor, data: l.data, categoria: l.categoria, descricao: String(l.descricao).slice(0, 120) }));
  const orcamentos = {};
  for (const [k, v] of Object.entries(bruto.orcamentos ?? {})) if (ids.has(k) && Number.isInteger(v) && v > 0) orcamentos[k] = v;
  const metas = (Array.isArray(bruto.metas) ? bruto.metas : [])
    .filter((m) => m && typeof m.id === "string" && typeof m.nome === "string" && Number.isInteger(m.alvo) && m.alvo > 0)
    .map((m) => ({
      id: m.id, nome: m.nome.slice(0, 60), alvo: m.alvo, prazo: dataValida(m.prazo) ? m.prazo : null,
      aportes: (Array.isArray(m.aportes) ? m.aportes : []).filter((a) => a && typeof a.id === "string" && dataValida(a.data) && Number.isInteger(a.valor) && a.valor !== 0),
    }));
  return { versao: VERSAO, exemplo: bruto.exemplo === true, categorias, lancamentos, orcamentos, metas };
}

export function carregar(armazenamento) {
  try {
    const texto = armazenamento?.getItem(CHAVE);
    if (!texto) return null;
    return sanear(JSON.parse(texto));
  } catch {
    return null; // JSON quebrado, armazenamento bloqueado ou modo privado
  }
}

export function salvar(armazenamento, dados) {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(dados));
    return true;
  } catch {
    return false; // cota cheia ou bloqueado: o painel segue funcionando, só não persiste
  }
}
