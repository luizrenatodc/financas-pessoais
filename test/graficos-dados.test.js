import { test } from "node:test";
import assert from "node:assert/strict";
import { barras, caminhoFatia, escalaNice, linhas, rosca } from "../src/graficos.js";
import { CHAVE, carregar, dadosVazios, garantirCategoria, salvar, sanear, slug, validarLancamento } from "../src/dados.js";
import { gerarExemplo } from "../src/semente.js";
import { resumoMes, linhasOrcamento, alertasOrcamento } from "../src/calculos.js";

test("escala do eixo usa degraus redondos e cobre o máximo", () => {
  for (const [max, esperado] of [[0, 100], [100, 100], [987, 1000], [123456, 150000], [250000, 250000], [1234567, 1500000], [7, 10]]) {
    const e = escalaNice(max);
    assert.ok(e.max >= max, `${max}: ${e.max}`);
    assert.equal(e.max % e.passo, 0);
    assert.ok(e.max / e.passo <= 6);
    if (max === 0) assert.equal(e.max, esperado);
  }
  assert.deepEqual(escalaNice(1000, 4), { max: 1000, passo: 250 });
});

test("caminho da fatia: meia volta, volta inteira e arco grande", () => {
  const meia = caminhoFatia(100, 100, 90, 50, -Math.PI / 2, Math.PI / 2);
  assert.match(meia, /^M100 10A90 90 0 0 1 100 190L100 150A50 50 0 0 0 100 50Z$/);
  const inteira = caminhoFatia(100, 100, 90, 50, -Math.PI / 2, Math.PI * 1.5);
  assert.equal((inteira.match(/M/g) || []).length, 2, "volta inteira é desenhada em duas metades");
  assert.match(caminhoFatia(100, 100, 90, 50, 0, 4), / 0 1 1 /, "mais de 180 graus usa o arco grande");
});

test("rosca: uma fatia por categoria, rótulos com percentual, total no centro", () => {
  const svg = rosca({ dados: [{ rotulo: "Moradia", valor: 75000, cor: 0 }, { rotulo: "Lazer", valor: 25000, cor: 4 }, { rotulo: "Zerada", valor: 0, cor: 2 }] });
  assert.equal((svg.match(/class="fatia /g) || []).length, 2, "valor zero não vira fatia");
  assert.match(svg, /Moradia: R\$\s1\.000,00? ?\(75%\)|Moradia: R\$.750,00 \(75%\)/);
  assert.match(svg, /Lazer: R\$.250,00 \(25%\)/);
  assert.match(svg, /R\$.1\.000,00<\/text>/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /class="fatia c0"/);
});

test("rosca vazia mostra um anel neutro, não quebra", () => {
  const svg = rosca({ dados: [] });
  assert.match(svg, /fatia vazia/);
  assert.match(svg, /R\$.0,00/);
});

test("rosca escapa texto de categorias", () => {
  const svg = rosca({ dados: [{ rotulo: '<img src=x onerror="a()">', valor: 100, cor: 1 }] });
  assert.ok(!svg.includes("<img"));
  assert.ok(svg.includes("&lt;img"));
});

test("barras: duas por período, altura proporcional, rótulos de eixo e dados acessíveis", () => {
  const svg = barras({ serie: [{ rotulo: "set/26", a: 400000, b: 200000 }, { rotulo: "out/26", a: 0, b: 0 }] });
  assert.equal((svg.match(/class="barra-a"/g) || []).length, 2);
  assert.equal((svg.match(/class="barra-b"/g) || []).length, 2);
  const alturas = [...svg.matchAll(/class="barra-[ab]"[^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(alturas[0] > alturas[1] * 1.9 && alturas[0] < alturas[1] * 2.1, "400 mil tem o dobro da altura de 200 mil");
  assert.equal(alturas[2], 0, "valor zero não desenha barra");
  assert.match(svg, /aria-label="Receitas e despesas por mês\. set\/26: Receitas/);
  assert.match(svg, /R\$ 4 mil/);
});

test("barras sem nenhum dado ainda desenham o eixo", () => {
  const svg = barras({ serie: [] });
  assert.match(svg, /<svg/);
  assert.match(svg, /R\$ 0/);
});

test("linhas: separa trechos por 'null', marca a ponta, desenha o limite e uma dica por dia", () => {
  const svg = linhas({
    dias: 5,
    series: [{ nome: "Este mês", valores: [100, 200, 300, null, null], classe: "atual", marcador: true }, { nome: "Mês anterior", valores: [50, 50, 400, 400, 500], classe: "anterior" }],
    limite: { valor: 600, rotulo: "Orçamento" },
  });
  assert.equal((svg.match(/class="linha atual"/g) || []).length, 1);
  assert.equal((svg.match(/class="ponta atual"/g) || []).length, 1);
  assert.match(svg, /class="limite"/);
  assert.equal((svg.match(/class="dica"/g) || []).length, 5);
  assert.match(svg, /Dia 4\. Mês anterior: R\$.4,00/);
  assert.ok(!/Dia 4\. Este mês/.test(svg), "dia sem valor não mostra a série");
  const buraco = linhas({ dias: 4, series: [{ nome: "x", valores: [1, null, 3, 4], classe: "a" }] });
  assert.equal((buraco.match(/M/g) || []).length, 2, "o 'null' no meio parte a linha em dois trechos");
});

test("linhas com mês de um dia só não dividem por zero", () => {
  const svg = linhas({ dias: 1, series: [{ nome: "x", valores: [100], classe: "a", marcador: true }] });
  assert.ok(!svg.includes("NaN") && !svg.includes("Infinity"));
});

// ------------------------------------------------------------------ dados e armazenamento
const armazenamentoFalso = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };

test("salvar e carregar devolvem os mesmos dados", () => {
  const a = armazenamentoFalso();
  const d = gerarExemplo("2026-11-10");
  assert.equal(salvar(a, d), true);
  assert.deepEqual(carregar(a), d);
});

test("armazenamento vazio, JSON quebrado ou bloqueado devolvem null sem lançar", () => {
  assert.equal(carregar(armazenamentoFalso()), null);
  const quebrado = armazenamentoFalso();
  quebrado.setItem(CHAVE, "{isto não é json");
  assert.equal(carregar(quebrado), null);
  assert.equal(carregar({ getItem() { throw new Error("bloqueado"); } }), null);
  assert.equal(salvar({ setItem() { throw new Error("cota cheia"); } }, dadosVazios()), false);
});

test("sanear descarta lançamentos, orçamentos e metas inválidos e mantém os bons", () => {
  const limpo = sanear({
    categorias: [{ id: "a", nome: "A", tipo: "despesa", cor: 1 }, { id: 5 }],
    lancamentos: [
      { id: "1", tipo: "despesa", valor: 100, data: "2026-11-05", categoria: "a", descricao: "ok" },
      { id: "2", tipo: "despesa", valor: -100, data: "2026-11-05", categoria: "a", descricao: "valor negativo" },
      { id: "3", tipo: "despesa", valor: 1.5, data: "2026-11-05", categoria: "a", descricao: "fracionado" },
      { id: "4", tipo: "despesa", valor: 100, data: "2026-02-31", categoria: "a", descricao: "data impossível" },
      { id: "5", tipo: "despesa", valor: 100, data: "2026-11-05", categoria: "inexistente", descricao: "categoria fantasma" },
      { id: "6", tipo: "troca", valor: 100, data: "2026-11-05", categoria: "a", descricao: "tipo ruim" },
      null, "texto",
    ],
    orcamentos: { a: 5000, b: 100, a2: -1 },
    metas: [{ id: "m", nome: "Meta", alvo: 1000, prazo: "lixo", aportes: [{ id: "x", data: "2026-11-01", valor: 10 }, { id: "y", data: "ruim", valor: 10 }] }, { id: "n", nome: "Sem alvo", alvo: 0 }],
  });
  assert.equal(limpo.categorias.length, 1);
  assert.deepEqual(limpo.lancamentos.map((l) => l.id), ["1"]);
  assert.deepEqual(limpo.orcamentos, { a: 5000 });
  assert.equal(limpo.metas.length, 1);
  assert.equal(limpo.metas[0].prazo, null);
  assert.equal(limpo.metas[0].aportes.length, 1);
  assert.equal(sanear(null), null);
  assert.equal(sanear("x"), null);
});

test("garantirCategoria acha por nome sem diferenciar acento ou caixa, e cria quando falta", () => {
  const d = dadosVazios();
  assert.equal(garantirCategoria(d, "ALIMENTAÇÃO", "despesa"), "alimentacao");
  const antes = d.categorias.length;
  const novo = garantirCategoria(d, "Pets", "despesa");
  assert.equal(novo, "pets");
  assert.equal(d.categorias.length, antes + 1);
  assert.equal(garantirCategoria(d, "pets", "despesa"), "pets", "não duplica");
  assert.equal(garantirCategoria(d, "Salário", "despesa"), "salario", "reaproveita categoria de outro tipo em vez de criar homônima");
  assert.equal(slug("Çà & é!"), "ca-e");
});

test("validarLancamento aponta cada problema", () => {
  assert.deepEqual(validarLancamento({ tipo: "despesa", valor: 100, data: "2026-11-05", categoria: "a", descricao: "x" }), []);
  assert.equal(validarLancamento({ tipo: "x", valor: 0, data: "2026-02-30", categoria: "", descricao: "  " }).length, 5);
});

// ------------------------------------------------------------------ dados de exemplo
test("dados de exemplo: determinísticos, sem datas no futuro e coerentes", () => {
  const a = gerarExemplo("2026-11-10"), b = gerarExemplo("2026-11-10");
  assert.deepEqual(a, b);
  assert.ok(a.lancamentos.length > 150);
  assert.ok(a.lancamentos.every((l) => l.data <= "2026-11-10"), "nada depois de hoje");
  assert.equal(new Set(a.lancamentos.map((l) => l.id)).size, a.lancamentos.length, "ids únicos");
  assert.deepEqual(sanear(a).lancamentos, a.lancamentos, "passa na validação inteira");
  const meses = new Set(a.lancamentos.map((l) => l.data.slice(0, 7)));
  assert.equal(meses.size, 6);
  assert.ok(resumoMes(a.lancamentos, "2026-10").saldo > 0, "o exemplo fecha o mês no azul");
});

test("dados de exemplo no fim do mês geram alertas de orçamento para o painel mostrar", () => {
  const d = gerarExemplo("2026-11-28");
  const linhas = linhasOrcamento(d.categorias, d.lancamentos, "2026-11", d.orcamentos);
  assert.ok(alertasOrcamento(linhas).length >= 1);
});

test("dados de exemplo funcionam em qualquer dia, inclusive 1º de janeiro e fevereiro bissexto", () => {
  for (const dia of ["2027-01-01", "2028-02-29", "2026-03-31", "2026-12-31"]) {
    const d = gerarExemplo(dia);
    assert.ok(d.lancamentos.every((l) => l.data <= dia && sanear({ ...d }).lancamentos.length === d.lancamentos.length), dia);
  }
});
