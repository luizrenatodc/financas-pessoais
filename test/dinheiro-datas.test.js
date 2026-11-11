import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarBRL, formatarCompacto, formatarNumero, lerValor } from "../src/dinheiro.js";
import { dataBR, dataValida, diasNoMes, diferencaMeses, lerData, nomeMes, somarMeses } from "../src/datas.js";

const sem = (s) => s.replace(/ /g, " ");

test("formata centavos em reais", () => {
  assert.equal(sem(formatarBRL(123456)), "R$ 1.234,56");
  assert.equal(sem(formatarBRL(0)), "R$ 0,00");
  assert.equal(sem(formatarBRL(-5)), "-R$ 0,05");
  assert.equal(formatarNumero(100000), "1.000,00");
});

test("formato compacto para eixos de gráfico", () => {
  assert.equal(sem(formatarCompacto(80000)), "R$ 800");
  assert.equal(sem(formatarCompacto(250000)), "R$ 2,5 mil");
  assert.equal(sem(formatarCompacto(1200000)), "R$ 12 mil");
  assert.equal(sem(formatarCompacto(-250000)), "-R$ 2,5 mil");
  assert.equal(sem(formatarCompacto(250000000)), "R$ 2,5 mi");
});

test("lerValor aceita os formatos brasileiros e de planilha", () => {
  const casos = [
    ["1.234,56", 123456], ["1234,56", 123456], ["1234.56", 123456], ["R$ 12,5", 1250], ["R$ 1.000,00", 100000],
    ["-3", -300], ["(45,90)", -4590], ["1.234", 123400], ["12.345.678", 1234567800], ["12.5", 1250], ["0,99", 99], [",5", 50],
    ["10", 1000], ["+7,5", 750], ["1,005", 101], ["1,004", 100],
  ];
  for (const [entrada, esperado] of casos) assert.equal(lerValor(entrada), esperado, `"${entrada}"`);
  assert.equal(lerValor(12.34), 1234);
});

test("lerValor recusa o que não é número", () => {
  for (const ruim of ["", "   ", "abc", "1,2,3", "1.2.3,4,5", "R$", "--5", "1e5", null, undefined, NaN, "12 reais"]) {
    assert.equal(lerValor(ruim), null, String(ruim));
  }
});

test("lerValor não sofre com ponto flutuante", () => {
  assert.equal(lerValor("0,1") + lerValor("0,2"), lerValor("0,3"));
  assert.equal(lerValor("19,99"), 1999);
  assert.equal(lerValor("1.005,15"), 100515);
});

test("datas: validação, dias do mês e aritmética de meses", () => {
  assert.equal(dataValida("2026-02-28"), true);
  assert.equal(dataValida("2026-02-29"), false);
  assert.equal(dataValida("2028-02-29"), true);
  assert.equal(dataValida("2026-13-01"), false);
  assert.equal(dataValida("26-01-01"), false);
  assert.equal(diasNoMes("2026-02"), 28);
  assert.equal(diasNoMes("2028-02"), 29);
  assert.equal(diasNoMes("2026-12"), 31);
  assert.equal(somarMeses("2026-11", 3), "2027-02");
  assert.equal(somarMeses("2026-01", -1), "2025-12");
  assert.equal(somarMeses("2026-01", -13), "2024-12");
  assert.equal(diferencaMeses("2026-11", "2027-02"), 3);
  assert.equal(diferencaMeses("2026-11", "2026-08"), -3);
});

test("lerData aceita ISO e formato brasileiro", () => {
  assert.equal(lerData("2026-11-05"), "2026-11-05");
  assert.equal(lerData("05/11/2026"), "2026-11-05");
  assert.equal(lerData("5/1/26"), "2026-01-05");
  assert.equal(lerData("2026-11-05T10:00:00Z"), "2026-11-05");
  assert.equal(lerData("31/02/2026"), null);
  assert.equal(lerData("ontem"), null);
  assert.equal(lerData(""), null);
});

test("nomes e formatos de data", () => {
  assert.equal(nomeMes("2026-11"), "Novembro de 2026");
  assert.equal(nomeMes("2026-03", true), "mar/26");
  assert.equal(dataBR("2026-11-05"), "05/11/2026");
});
