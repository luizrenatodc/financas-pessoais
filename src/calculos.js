// Toda a lógica de cálculo, sem DOM: totais, categorias, orçamento, metas e séries dos gráficos.
import { diasNoMes, diferencaMeses, mesDe, somarMeses } from "./datas.js";

export const LIMITE_ALERTA = 0.8; // a partir de 80% do orçamento o alerta acende

const soma = (lista, f = (x) => x) => lista.reduce((s, x) => s + f(x), 0);

/** Receitas, despesas, saldo e taxa de poupança do mês. */
export function resumoMes(lancamentos, ym) {
  const doMes = lancamentos.filter((l) => mesDe(l.data) === ym);
  const receitas = soma(doMes.filter((l) => l.tipo === "receita"), (l) => l.valor);
  const despesas = soma(doMes.filter((l) => l.tipo === "despesa"), (l) => l.valor);
  return {
    receitas,
    despesas,
    saldo: receitas - despesas,
    taxaPoupanca: receitas > 0 ? (receitas - despesas) / receitas : null,
    quantidade: doMes.length,
  };
}

/** Total por categoria no mês, do maior para o menor. `tipo` escolhe despesas ou receitas. */
export function totaisPorCategoria(lancamentos, ym, tipo = "despesa") {
  const mapa = new Map();
  for (const l of lancamentos) {
    if (l.tipo !== tipo || mesDe(l.data) !== ym) continue;
    mapa.set(l.categoria, (mapa.get(l.categoria) ?? 0) + l.valor);
  }
  return [...mapa].map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria));
}

/** Os `n` meses que terminam em `ymFim`, em ordem cronológica. */
export function serieMensal(lancamentos, ymFim, n = 6) {
  const saida = [];
  for (let i = n - 1; i >= 0; i--) {
    const ym = somarMeses(ymFim, -i);
    const { receitas, despesas } = resumoMes(lancamentos, ym);
    saida.push({ ym, receitas, despesas });
  }
  return saida;
}

/** Despesas acumuladas dia a dia. Se o mês é o de `hoje`, os dias futuros ficam `null`. */
export function gastosAcumulados(lancamentos, ym, hoje = null) {
  const dias = diasNoMes(ym);
  const porDia = new Array(dias).fill(0);
  for (const l of lancamentos) if (l.tipo === "despesa" && mesDe(l.data) === ym) porDia[Number(l.data.slice(8, 10)) - 1] += l.valor;
  const ultimo = hoje && mesDe(hoje) === ym ? Number(hoje.slice(8, 10)) : hoje && mesDe(hoje) < ym ? 0 : dias;
  let acc = 0;
  return porDia.map((v, i) => {
    acc += v;
    return i < ultimo ? acc : null;
  });
}

/** Situação de um gasto frente ao limite: ok, alerta (>= 80%), estourado (> 100%) ou sem-limite. */
export function statusOrcamento(gasto, limite) {
  if (!limite || limite <= 0) return { estado: "sem-limite", pct: 0, restante: null };
  const pct = gasto / limite;
  const estado = pct > 1 ? "estourado" : pct >= LIMITE_ALERTA ? "alerta" : "ok";
  return { estado, pct, restante: limite - gasto };
}

/** Uma linha por categoria de despesa que tenha limite ou gasto no mês. */
export function linhasOrcamento(categorias, lancamentos, ym, orcamentos) {
  const gastos = new Map(totaisPorCategoria(lancamentos, ym, "despesa").map((t) => [t.categoria, t.total]));
  const linhas = [];
  for (const c of categorias.filter((c) => c.tipo === "despesa")) {
    const gasto = gastos.get(c.id) ?? 0;
    const limite = orcamentos[c.id] ?? 0;
    if (!gasto && !limite) continue;
    linhas.push({ categoria: c, gasto, limite, ...statusOrcamento(gasto, limite) });
  }
  const peso = { estourado: 0, alerta: 1, ok: 2, "sem-limite": 3 };
  return linhas.sort((a, b) => peso[a.estado] - peso[b.estado] || b.pct - a.pct || b.gasto - a.gasto);
}

/** Mensagens de alerta, as mais graves primeiro. */
export function alertasOrcamento(linhas) {
  return linhas
    .filter((l) => l.estado === "alerta" || l.estado === "estourado")
    .map((l) => ({
      categoria: l.categoria.nome,
      estado: l.estado,
      excesso: l.estado === "estourado" ? l.gasto - l.limite : 0,
      pct: l.pct,
    }));
}

export function totalOrcado(categorias, orcamentos) {
  return soma(categorias.filter((c) => c.tipo === "despesa"), (c) => orcamentos[c.id] ?? 0);
}

/** Progresso de uma meta de economia e quanto guardar por mês para chegar no prazo. */
export function progressoMeta(meta, hoje) {
  const guardado = soma(meta.aportes ?? [], (a) => a.valor);
  const falta = Math.max(0, meta.alvo - guardado);
  const concluida = guardado >= meta.alvo;
  const pct = meta.alvo > 0 ? Math.max(0, Math.min(1, guardado / meta.alvo)) : 0;
  const res = { guardado, falta, pct, concluida, atrasada: false, mesesRestantes: null, aporteMensal: null, previsao: null, ritmoMensal: 0 };

  // ritmo: média dos aportes dos últimos três meses (o atual e os dois anteriores)
  const mesAtual = mesDe(hoje);
  const janela = [mesAtual, somarMeses(mesAtual, -1), somarMeses(mesAtual, -2)];
  res.ritmoMensal = Math.round(soma((meta.aportes ?? []).filter((a) => janela.includes(mesDe(a.data))), (a) => a.valor) / 3);
  if (!concluida && res.ritmoMensal > 0) res.previsao = somarMeses(mesAtual, Math.ceil(falta / res.ritmoMensal));

  if (meta.prazo && !concluida) {
    if (meta.prazo < hoje) {
      res.atrasada = true;
      res.mesesRestantes = 0;
      res.aporteMensal = falta;
    } else {
      res.mesesRestantes = Math.max(1, diferencaMeses(mesAtual, mesDe(meta.prazo)));
      res.aporteMensal = Math.ceil(falta / res.mesesRestantes);
    }
  }
  return res;
}

/** Filtra e ordena (mais recentes primeiro). `categoria` vazio = todas. */
export function filtrarLancamentos(lancamentos, { ym = null, tipo = "todos", categoria = "", busca = "" } = {}, nomesCategorias = {}) {
  const termo = busca.trim().toLowerCase();
  return lancamentos
    .filter((l) => (!ym || mesDe(l.data) === ym) && (tipo === "todos" || l.tipo === tipo) && (!categoria || l.categoria === categoria))
    .filter((l) => !termo || l.descricao.toLowerCase().includes(termo) || (nomesCategorias[l.categoria] ?? "").toLowerCase().includes(termo))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.id.localeCompare(a.id)));
}

/** Meses que têm lançamentos, do mais recente para o mais antigo. */
export function mesesComDados(lancamentos) {
  return [...new Set(lancamentos.map((l) => mesDe(l.data)))].sort().reverse();
}

/** Agrupa as menores fatias em "Demais" para a rosca não virar confete. */
export function agruparFatias(itens, max = 7) {
  if (itens.length <= max) return itens;
  const ordenados = [...itens].sort((a, b) => b.valor - a.valor);
  const topo = ordenados.slice(0, max - 1);
  const resto = ordenados.slice(max - 1);
  return [...topo, { rotulo: "Demais", valor: soma(resto, (x) => x.valor), cor: -1, itens: resto }];
}
