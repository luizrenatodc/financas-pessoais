// Dados de exemplo (fictícios) gerados a partir da data de hoje, sempre os mesmos para a mesma data.
import { dadosVazios } from "./dados.js";
import { diasNoMes, mesDe, somarMeses } from "./datas.js";

function gerador(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gerarExemplo(hoje) {
  const dados = dadosVazios();
  dados.exemplo = true;
  const rnd = gerador(2026);
  const entre = (min, max) => Math.round(min + rnd() * (max - min)); // reais inteiros
  const reais = (v) => Math.round(v * 100);
  const mesAtual = mesDe(hoje);
  const diaHoje = Number(hoje.slice(8, 10));
  let n = 0;
  const lanc = (ym, dia, tipo, categoria, descricao, valor) => {
    const dias = diasNoMes(ym);
    const d = Math.min(dia, dias);
    if (ym === mesAtual && d > diaHoje) return; // nada no futuro
    dados.lancamentos.push({ id: `ex${String(++n).padStart(4, "0")}`, tipo, categoria, descricao, valor, data: `${ym}-${String(d).padStart(2, "0")}` });
  };
  const dia = (a, b) => Math.floor(a + rnd() * (b - a + 1));

  for (let i = 5; i >= 0; i--) {
    const ym = somarMeses(mesAtual, -i);
    lanc(ym, 5, "receita", "salario", "Salário", reais(7200));
    lanc(ym, 28, "receita", "investimentos", "Rendimentos da renda fixa", reais(entre(150, 260)));
    if (i === 4 || i === 1) lanc(ym, dia(12, 20), "receita", "freelance", "Projeto de identidade visual", reais(entre(900, 1800)));
    if (i === 2) lanc(ym, 20, "receita", "outras-receitas", "Venda de bicicleta usada", reais(650));

    lanc(ym, 8, "despesa", "moradia", "Aluguel", reais(2100));
    lanc(ym, 10, "despesa", "moradia", "Condomínio", reais(480));
    lanc(ym, 15, "despesa", "moradia", "Conta de luz", reais(entre(150, 240)));
    lanc(ym, 12, "despesa", "moradia", "Internet", reais(119.9));
    lanc(ym, 10, "despesa", "saude", "Plano de saúde", reais(389.9));
    lanc(ym, 3, "despesa", "assinaturas", "Streaming de vídeo", reais(39.9));
    lanc(ym, 3, "despesa", "assinaturas", "Streaming de música", reais(21.9));
    lanc(ym, 7, "despesa", "assinaturas", "Armazenamento em nuvem", reais(9.9));
    lanc(ym, 6, "despesa", "assinaturas", "Academia", reais(119.9));
    if (i <= 2) lanc(ym, 14, "despesa", "educacao", "Curso de inglês", reais(189));

    const intensidade = 1; // o mês atual puxa um pouco para cima, para o painel ter o que alertar
    const mercados = ["Supermercado do bairro", "Feira livre", "Atacadão", "Padaria", "Hortifruti"];
    for (let k = 0; k < 5; k++) lanc(ym, dia(2 + k * 5, 6 + k * 5), "despesa", "alimentacao", mercados[k % mercados.length], reais(entre(70, 300) * intensidade));
    const comer = ["Almoço com a equipe", "Pizza de sexta", "Delivery de hambúrguer", "Café da manhã na padaria", "Sushi no sábado", "Lanche"];
    for (let k = 0; k < 5; k++) lanc(ym, dia(1 + k * 6, 6 + k * 6), "despesa", "alimentacao", comer[(k + i) % comer.length], reais(entre(32, 98)));

    for (let k = 0; k < 2; k++) lanc(ym, dia(4 + k * 13, 14 + k * 13), "despesa", "transporte", "Combustível", reais(entre(170, 260)));
    for (let k = 0; k < 4; k++) lanc(ym, dia(2 + k * 7, 8 + k * 7), "despesa", "transporte", k % 2 ? "Corrida de aplicativo" : "Estacionamento", reais(entre(12, 42)));
    lanc(ym, dia(5, 25), "despesa", "saude", "Farmácia", reais(entre(40, 130)));
    if (i % 2 === 0) lanc(ym, dia(12, 26), "despesa", "saude", "Consulta odontológica", reais(180));

    const lazer = ["Cinema", "Show", "Bar com amigos", "Jogo no estádio", "Livraria", "Parque"];
    for (let k = 0; k < 3; k++) lanc(ym, dia(3 + k * 9, 11 + k * 9), "despesa", "lazer", lazer[(k * 2 + i) % lazer.length], reais(entre(40, 190) * (i === 0 ? 1.3 : 1)));
    const compras = ["Roupas", "Tênis de corrida", "Presente de aniversário", "Itens para casa", "Fone de ouvido"];
    for (let k = 0; k < 2; k++) lanc(ym, dia(5 + k * 10, 14 + k * 10), "despesa", "compras", compras[(k + i) % compras.length], reais(entre(60, 340)));
  }

  dados.orcamentos = { moradia: reais(3600), alimentacao: reais(1700), transporte: reais(750), saude: reais(900), lazer: reais(450), assinaturas: reais(250), compras: reais(500), educacao: reais(250) };

  const aporte = (mesesAtras, dd, valor) => ({ id: `ap${++n}`, data: `${somarMeses(mesAtual, -mesesAtras)}-${String(Math.min(dd, 28)).padStart(2, "0")}`, valor: reais(valor) });
  dados.metas = [
    { id: "meta-reserva", nome: "Reserva de emergência", alvo: reais(20000), prazo: `${somarMeses(mesAtual, 14)}-10`, aportes: [aporte(5, 6, 1500), aporte(4, 6, 1500), aporte(3, 6, 1200), aporte(2, 6, 1500), aporte(1, 6, 1500), aporte(0, 1, 800)].filter((a) => a.data <= hoje) },
    { id: "meta-viagem", nome: "Viagem para a Chapada Diamantina", alvo: reais(6000), prazo: `${somarMeses(mesAtual, 7)}-01`, aportes: [aporte(4, 10, 600), aporte(3, 10, 600), aporte(2, 10, 500), aporte(1, 10, 650)] },
    { id: "meta-celular", nome: "Celular novo", alvo: reais(3200), prazo: null, aportes: [aporte(5, 12, 1200), aporte(3, 12, 1000), aporte(2, 12, 1000)] },
  ];
  return dados;
}
