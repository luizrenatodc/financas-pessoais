import { test } from "node:test";
import assert from "node:assert/strict";
import { detectarDelimitador, exportarCSV, importarCSV, lerLinhasCSV } from "../src/csv.js";

const nomes = { alimentacao: "Alimentação", moradia: "Moradia", salario: "Salário" };
const nome = (id) => nomes[id] ?? id;

test("exporta com BOM, ponto e vírgula, vírgula decimal e quebras CRLF", () => {
  const csv = exportarCSV([{ id: "b", data: "2026-11-02", tipo: "despesa", categoria: "alimentacao", descricao: "Mercado", valor: 123456 }, { id: "a", data: "2026-11-01", tipo: "receita", categoria: "salario", descricao: "Salário", valor: 500000 }], nome);
  assert.ok(csv.startsWith("﻿data;tipo;categoria;descricao;valor\r\n"));
  assert.deepEqual(csv.split("\r\n").slice(1, 3), ["2026-11-01;receita;Salário;Salário;5000,00", "2026-11-02;despesa;Alimentação;Mercado;1234,56"], "ordenado por data, sem separador de milhar");
});

test("exportar e importar devolve os mesmos lançamentos (ida e volta)", () => {
  const original = [
    { id: "1", data: "2026-11-02", tipo: "despesa", categoria: "alimentacao", descricao: 'Jantar "especial"; com ponto e vírgula', valor: 8990 },
    { id: "2", data: "2026-11-03", tipo: "despesa", categoria: "moradia", descricao: "Linha 1\nlinha 2", valor: 1 },
    { id: "3", data: "2026-11-04", tipo: "receita", categoria: "salario", descricao: "Salário", valor: 123456789 },
  ];
  const { itens, erros } = importarCSV(exportarCSV(original, nome));
  assert.deepEqual(erros, []);
  assert.deepEqual(itens.map((i) => [i.data, i.tipo, i.categoria, i.descricao, i.valor]), original.map((o) => [o.data, o.tipo, nome(o.categoria), o.descricao, o.valor]));
});

test("campos que parecem fórmula são neutralizados na exportação e restaurados na importação", () => {
  const csv = exportarCSV([{ id: "1", data: "2026-11-02", tipo: "despesa", categoria: "x", descricao: "=HYPERLINK(\"http://x\")", valor: 100 }], nome);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.equal(importarCSV(csv).itens[0].descricao, '=HYPERLINK("http://x")');
});

test("importa planilha com vírgula, datas brasileiras e sinal no lugar do tipo", () => {
  const texto = "Data,Descrição,Valor,Categoria\n05/11/2026,Salário,\"7.200,00\",Salário\n06/11/2026,Padaria,-12.5,Alimentação\n";
  const { itens, erros } = importarCSV(texto);
  assert.deepEqual(erros, []);
  assert.deepEqual(itens[0], { data: "2026-11-05", tipo: "receita", categoria: "Salário", descricao: "Salário", valor: 720000 });
  assert.deepEqual(itens[1], { data: "2026-11-06", tipo: "despesa", categoria: "Alimentação", descricao: "Padaria", valor: 1250 });
});

test("sem categoria nem descrição, usa padrões razoáveis", () => {
  const { itens } = importarCSV("data;valor\n2026-11-05;-10\n2026-11-06;20\n");
  assert.equal(itens[0].categoria, "Outros");
  assert.equal(itens[0].descricao, "Outros");
  assert.equal(itens[1].categoria, "Outras receitas");
});

test("reporta cada linha ruim com o número da linha e segue com as boas", () => {
  const texto = "data;tipo;categoria;descricao;valor\n2026-11-05;despesa;Lazer;Cinema;40,00\n31/02/2026;despesa;Lazer;Data impossível;10\n2026-11-07;talvez;Lazer;Tipo estranho;10\n2026-11-08;despesa;Lazer;Sem valor;\n2026-11-09;despesa;Lazer;Zero;0\n2026-11-10;despesa;Lazer;Boa;5\n";
  const { itens, erros } = importarCSV(texto);
  assert.equal(itens.length, 2);
  assert.deepEqual(erros.map((e) => e.linha), [3, 4, 5, 6]);
  assert.match(erros[0].motivo, /Data inválida/);
  assert.match(erros[1].motivo, /Tipo desconhecido/);
  assert.match(erros[2].motivo, /Valor inválido/);
});

test("cabeçalho sem data ou valor, arquivo vazio e só cabeçalho", () => {
  assert.match(importarCSV("nome;idade\nAna;30\n").erros[0].motivo, /cabeçalho/);
  assert.match(importarCSV("").erros[0].motivo, /vazio/);
  assert.match(importarCSV("   \n").erros[0].motivo, /vazio/);
  assert.deepEqual(importarCSV("data;valor\n"), { itens: [], erros: [] });
});

test("aceita sinônimos de cabeçalho em inglês e tipo em vários nomes", () => {
  const { itens, erros } = importarCSV("Date;Type;Category;Description;Amount\n2026-11-05;income;Salary;Pay;100,00\n2026-11-06;expense;Food;Lunch;20,00\n");
  assert.deepEqual(erros, []);
  assert.deepEqual(itens.map((i) => i.tipo), ["receita", "despesa"]);
});

test("detecta o delimitador pelo cabeçalho", () => {
  assert.equal(detectarDelimitador("a;b;c"), ";");
  assert.equal(detectarDelimitador("a,b,c"), ",");
  assert.equal(detectarDelimitador("a\tb\tc"), "\t");
  assert.equal(detectarDelimitador("﻿data;valor"), ";");
});

test("o leitor de CSV lida com aspas duplas, quebra dentro de campo, CRLF, CR e linhas em branco", () => {
  assert.deepEqual(lerLinhasCSV('a;"b ""c"" d";e\r\n\r\n1;"x\ny";3', ";"), [["a", 'b "c" d', "e"], ["1", "x\ny", "3"]]);
  assert.deepEqual(lerLinhasCSV("a;b\rc;d\r", ";"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(lerLinhasCSV("a;;c\n", ";"), [["a", "", "c"]]);
  assert.deepEqual(lerLinhasCSV(";\n", ";"), []);
});

test("limita descrição e categoria longas", () => {
  const { itens } = importarCSV(`data;valor;descricao;categoria\n2026-11-05;10;${"x".repeat(500)};${"c".repeat(100)}\n`);
  assert.equal(itens[0].descricao.length, 120);
  assert.equal(itens[0].categoria.length, 40);
});
