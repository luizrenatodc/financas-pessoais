import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparFatias, alertasOrcamento, filtrarLancamentos, gastosAcumulados, linhasOrcamento, mesesComDados, progressoMeta, resumoMes,
  serieMensal, statusOrcamento, totaisPorCategoria, totalOrcado,
} from "../src/calculos.js";
import { CATEGORIAS_PADRAO } from "../src/dados.js";

let i = 0;
const L = (data, tipo, categoria, valor, descricao = "x") => ({ id: `id${String(++i).padStart(3, "0")}`, data, tipo, categoria, valor, descricao });
const base = [
  L("2026-11-05", "receita", "salario", 500000),
  L("2026-11-28", "receita", "investimentos", 20000),
  L("2026-11-08", "despesa", "moradia", 210000),
  L("2026-11-09", "despesa", "alimentacao", 30000),
  L("2026-11-20", "despesa", "alimentacao", 15050),
  L("2026-11-21", "despesa", "lazer", 9990),
  L("2026-10-05", "receita", "salario", 500000),
  L("2026-10-08", "despesa", "moradia", 210000),
  L("2026-10-15", "despesa", "alimentacao", 40000),
];

test("resumo do mês: receitas, despesas, saldo e taxa de poupança", () => {
  const r = resumoMes(base, "2026-11");
  assert.equal(r.receitas, 520000);
  assert.equal(r.despesas, 265040);
  assert.equal(r.saldo, 254960);
  assert.ok(Math.abs(r.taxaPoupanca - 254960 / 520000) < 1e-12);
  assert.equal(r.quantidade, 6);
});

test("mês sem receita não tem taxa de poupança (evita divisão por zero)", () => {
  const r = resumoMes([L("2026-09-01", "despesa", "lazer", 1000)], "2026-09");
  assert.equal(r.taxaPoupanca, null);
  assert.equal(r.saldo, -1000);
  assert.deepEqual(resumoMes([], "2026-01"), { receitas: 0, despesas: 0, saldo: 0, taxaPoupanca: null, quantidade: 0 });
});

test("totais por categoria vêm do maior para o menor e respeitam o tipo", () => {
  assert.deepEqual(totaisPorCategoria(base, "2026-11"), [
    { categoria: "moradia", total: 210000 }, { categoria: "alimentacao", total: 45050 }, { categoria: "lazer", total: 9990 },
  ]);
  assert.deepEqual(totaisPorCategoria(base, "2026-11", "receita").map((t) => t.categoria), ["salario", "investimentos"]);
});

test("série mensal cobre meses sem lançamento e atravessa a virada de ano", () => {
  const s = serieMensal(base, "2026-11", 3);
  assert.deepEqual(s.map((x) => x.ym), ["2026-09", "2026-10", "2026-11"]);
  assert.deepEqual([s[0].receitas, s[0].despesas], [0, 0]);
  assert.equal(s[1].despesas, 250000);
  assert.deepEqual(serieMensal([], "2026-02", 4).map((x) => x.ym), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("gastos acumulados somam dia a dia e escondem o futuro no mês corrente", () => {
  const completo = gastosAcumulados(base, "2026-11");
  assert.equal(completo.length, 30);
  assert.equal(completo[6], 0);
  assert.equal(completo[7], 210000);
  assert.equal(completo[29], 265040);
  const ateDia10 = gastosAcumulados(base, "2026-11", "2026-11-10");
  assert.equal(ateDia10[9], 240000);
  assert.equal(ateDia10[10], null);
  assert.equal(gastosAcumulados(base, "2026-10", "2026-11-10").at(-1), 250000, "mês passado aparece inteiro");
  assert.ok(gastosAcumulados(base, "2026-12", "2026-11-10").every((v) => v === null), "mês futuro fica vazio");
});

test("status do orçamento: ok, alerta em 80%, estourado acima de 100%", () => {
  assert.equal(statusOrcamento(7999, 10000).estado, "ok");
  assert.equal(statusOrcamento(8000, 10000).estado, "alerta");
  assert.equal(statusOrcamento(10000, 10000).estado, "alerta");
  assert.equal(statusOrcamento(10001, 10000).estado, "estourado");
  assert.deepEqual(statusOrcamento(5000, 0), { estado: "sem-limite", pct: 0, restante: null });
  assert.equal(statusOrcamento(2500, 10000).restante, 7500);
  assert.equal(statusOrcamento(12000, 10000).restante, -2000);
});

test("linhas de orçamento ordenam o que está pior primeiro e escondem categorias vazias", () => {
  const linhas = linhasOrcamento(CATEGORIAS_PADRAO, base, "2026-11", { moradia: 300000, alimentacao: 50000, lazer: 5000, saude: 70000 });
  assert.deepEqual(linhas.map((l) => [l.categoria.id, l.estado]), [["lazer", "estourado"], ["alimentacao", "alerta"], ["moradia", "ok"], ["saude", "ok"]]);
  assert.ok(!linhas.some((l) => l.categoria.id === "educacao"), "sem gasto e sem limite não aparece");
  const alertas = alertasOrcamento(linhas);
  assert.deepEqual(alertas.map((a) => a.categoria), ["Lazer", "Alimentação"]);
  assert.equal(alertas[0].excesso, 4990);
  assert.equal(alertas[1].excesso, 0);
});

test("categoria com gasto e sem limite aparece como sem-limite, por último", () => {
  const linhas = linhasOrcamento(CATEGORIAS_PADRAO, base, "2026-11", { alimentacao: 100000 });
  assert.equal(linhas.at(-1).estado, "sem-limite");
  assert.equal(totalOrcado(CATEGORIAS_PADRAO, { alimentacao: 100000, salario: 999 }), 100000, "receita não entra no total orçado");
});

test("meta com prazo: quanto guardar por mês, sem passar de 100% e sem números quebrados", () => {
  const meta = { alvo: 1200000, prazo: "2027-05-10", aportes: [{ id: "a", data: "2026-10-10", valor: 200000 }, { id: "b", data: "2026-11-02", valor: 100000 }] };
  const p = progressoMeta(meta, "2026-11-10");
  assert.equal(p.guardado, 300000);
  assert.equal(p.falta, 900000);
  assert.equal(p.pct, 0.25);
  assert.equal(p.mesesRestantes, 6);
  assert.equal(p.aporteMensal, 150000);
  assert.equal(p.ritmoMensal, 100000); // 300 mil nos últimos 3 meses / 3
  assert.equal(p.previsao, "2027-08"); // 9 meses a esse ritmo
  assert.equal(p.concluida, false);
  assert.equal(p.atrasada, false);
});

test("meta concluída, estourada, atrasada e sem prazo", () => {
  const feita = progressoMeta({ alvo: 100000, prazo: "2027-01-01", aportes: [{ id: "a", data: "2026-10-10", valor: 150000 }] }, "2026-11-10");
  assert.equal(feita.concluida, true);
  assert.equal(feita.pct, 1);
  assert.equal(feita.falta, 0);
  assert.equal(feita.aporteMensal, null);
  const atrasada = progressoMeta({ alvo: 100000, prazo: "2026-10-01", aportes: [{ id: "a", data: "2026-06-10", valor: 30000 }] }, "2026-11-10");
  assert.equal(atrasada.atrasada, true);
  assert.equal(atrasada.aporteMensal, 70000);
  assert.equal(atrasada.previsao, null, "sem aportes recentes não há previsão");
  const semPrazo = progressoMeta({ alvo: 100000, prazo: null, aportes: [] }, "2026-11-10");
  assert.equal(semPrazo.aporteMensal, null);
  assert.equal(semPrazo.pct, 0);
  const retirada = progressoMeta({ alvo: 100000, prazo: null, aportes: [{ id: "a", data: "2026-11-01", valor: 50000 }, { id: "b", data: "2026-11-02", valor: -80000 }] }, "2026-11-10");
  assert.equal(retirada.pct, 0, "retiradas não deixam o percentual negativo");
});

test("prazo no mesmo mês conta como um mês restante", () => {
  const p = progressoMeta({ alvo: 90000, prazo: "2026-11-30", aportes: [] }, "2026-11-10");
  assert.equal(p.mesesRestantes, 1);
  assert.equal(p.aporteMensal, 90000);
});

test("filtros por mês, tipo, categoria e busca; ordenação mais recente primeiro", () => {
  const nomes = { alimentacao: "Alimentação" };
  const dados = [L("2026-11-01", "despesa", "alimentacao", 100, "Pão"), L("2026-11-03", "despesa", "alimentacao", 200, "Mercado"), L("2026-11-03", "receita", "salario", 900, "Salário")];
  assert.deepEqual(filtrarLancamentos(dados, { ym: "2026-11" }).map((l) => l.descricao), ["Salário", "Mercado", "Pão"]);
  assert.equal(filtrarLancamentos(dados, { ym: "2026-10" }).length, 0);
  assert.equal(filtrarLancamentos(dados, { tipo: "receita" }).length, 1);
  assert.equal(filtrarLancamentos(dados, { categoria: "alimentacao" }).length, 2);
  assert.equal(filtrarLancamentos(dados, { busca: "mercado" }).length, 1);
  assert.equal(filtrarLancamentos(dados, { busca: "alimenta" }, nomes).length, 2, "busca também olha o nome da categoria");
  assert.equal(filtrarLancamentos(dados, { ym: "2026-11", tipo: "despesa", busca: "pão" }).length, 1);
});

test("meses com dados, do mais novo para o mais antigo, sem repetir", () => {
  assert.deepEqual(mesesComDados(base), ["2026-11", "2026-10"]);
  assert.deepEqual(mesesComDados([]), []);
});

test("agrupar fatias: até 7 ficam como estão, acima disso as menores viram 'Demais'", () => {
  const itens = Array.from({ length: 10 }, (_, k) => ({ rotulo: `c${k}`, valor: (k + 1) * 100, cor: k }));
  assert.equal(agruparFatias(itens.slice(0, 7)).length, 7);
  const g = agruparFatias(itens, 7);
  assert.equal(g.length, 7);
  assert.equal(g.at(-1).rotulo, "Demais");
  assert.equal(g.at(-1).valor, 100 + 200 + 300 + 400, "soma das 4 menores");
  assert.equal(g.reduce((s, x) => s + x.valor, 0), itens.reduce((s, x) => s + x.valor, 0), "o total se preserva");
});
