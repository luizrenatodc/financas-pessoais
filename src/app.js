// Interface do painel. Toda a regra de cálculo está em calculos.js; aqui só tem tela, eventos e armazenamento.
import { formatarBRL, formatarNumero, lerValor } from "./dinheiro.js";
import { dataBR, dataValida, hojeISO, mesDe, nomeMes, somarMeses } from "./datas.js";
import {
  agruparFatias, alertasOrcamento, filtrarLancamentos, gastosAcumulados, linhasOrcamento, mesesComDados, progressoMeta, resumoMes,
  serieMensal, totaisPorCategoria, totalOrcado,
} from "./calculos.js";
import { carregar, dadosVazios, garantirCategoria, novoId, salvar, validarLancamento } from "./dados.js";
import { exportarCSV, importarCSV } from "./csv.js";
import { barras, esc, linhas, rosca } from "./graficos.js";
import { gerarExemplo } from "./semente.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const moeda = formatarBRL;

const params = new URLSearchParams(location.search);
const HOJE = dataValida(params.get("hoje")) ? params.get("hoje") : hojeISO();
const lerArmazenamento = () => { try { return window.localStorage; } catch { return null; } };
const armazenamento = lerArmazenamento();

let dados = carregar(armazenamento);
if (!dados) { dados = gerarExemplo(HOJE); salvar(armazenamento, dados); }
const filtros = { tipo: "todos", categoria: "", busca: "", todosMeses: false };
let ym = /^\d{4}-\d{2}$/.test(params.get("mes") ?? "") ? params.get("mes") : mesInicial();
let ultimoExcluido = null;

function mesInicial() {
  const atual = mesDe(HOJE);
  if (dados.lancamentos.filter((l) => mesDe(l.data) === atual).length >= 6) return atual;
  return mesesComDados(dados.lancamentos).find((m) => dados.lancamentos.filter((l) => mesDe(l.data) === m).length >= 6) ?? atual;
}

const persistir = () => {
  if (!salvar(armazenamento, dados)) avisar("Não consegui gravar no navegador (armazenamento cheio ou bloqueado). Exporte um CSV para não perder os dados.", { ruim: true });
};
const categoria = (id) => dados.categorias.find((c) => c.id === id);
const nomeCategoria = (id) => categoria(id)?.nome ?? id;
const nomes = () => Object.fromEntries(dados.categorias.map((c) => [c.id, c.nome]));
const corCat = (id) => (categoria(id)?.cor ?? 0) % 10;
const pontoCat = (id) => `<span class="ponto c${corCat(id)}" aria-hidden="true"></span>`;
const pct = (v) => `${Math.round(v * 100)}%`;

// ---------------------------------------------------------------- tema
const TEMA = "financas.tema";
function aplicarTema() {
  let t = null;
  try { t = armazenamento?.getItem(TEMA); } catch { /* sem armazenamento */ }
  if (t === "claro" || t === "escuro") document.documentElement.dataset.tema = t;
  else delete document.documentElement.dataset.tema;
}
function alternarTema() {
  const escuro = (document.documentElement.dataset.tema ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro")) === "escuro";
  try { armazenamento?.setItem(TEMA, escuro ? "claro" : "escuro"); } catch { /* sem armazenamento */ }
  aplicarTema();
  desenharGraficos();
}
aplicarTema();

// ---------------------------------------------------------------- esqueleto
const iconeSol = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5m14 0h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>';
const iconeLapis = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const iconeLixo = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';

$("#app").innerHTML = `
<header class="topo">
  <div class="marca"><img src="icone.svg" alt="" width="28" height="28"><span>Finanças</span></div>
  <nav class="mes" aria-label="Mês exibido">
    <button class="icone" id="mes-ant" aria-label="Mês anterior"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>
    <h1 id="mes-rotulo" aria-live="polite"></h1>
    <button class="icone" id="mes-prox" aria-label="Próximo mês"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
    <button class="botao sutil" id="mes-hoje" hidden>Mês atual</button>
  </nav>
  <div class="acoes-topo">
    <button class="botao primario" id="novo" title="Atalho: N">+ Lançamento</button>
    <details class="menu" id="menu">
      <summary class="botao">Dados</summary>
      <div class="menu-lista" role="menu">
        <button role="menuitem" data-acao="exportar-mes">Exportar este mês (CSV)</button>
        <button role="menuitem" data-acao="exportar-tudo">Exportar tudo (CSV)</button>
        <button role="menuitem" data-acao="importar">Importar CSV…</button>
        <hr>
        <button role="menuitem" data-acao="exemplo">Carregar dados de exemplo</button>
        <button role="menuitem" data-acao="limpar" class="perigo">Apagar todos os dados</button>
      </div>
    </details>
    <button class="icone" id="tema" aria-label="Alternar entre tema claro e escuro" title="Tema claro/escuro">${iconeSol}</button>
  </div>
</header>
<main id="conteudo">
  <div id="aviso-exemplo"></div>
  <section id="alertas" aria-label="Alertas de orçamento"></section>
  <section class="kpis" id="kpis" aria-label="Resumo do mês"></section>
  <div class="paineis">
    <section class="cartao c-rosca" aria-labelledby="t-rosca"><h2 id="t-rosca">Para onde foi o dinheiro</h2><div class="rosca-area"><div id="rosca" class="rosca"></div><ul id="legenda" class="legenda"></ul></div></section>
    <section class="cartao c-orc" aria-labelledby="t-orc"><h2 id="t-orc">Orçamento do mês <button class="botao sutil" id="editar-limites">Editar limites</button></h2><div id="orcamento"></div></section>
    <section class="cartao c-barras" aria-labelledby="t-barras"><h2 id="t-barras">Receitas e despesas</h2>
      <p class="chaves"><span><i class="amostra barra-a"></i>Receitas</span><span><i class="amostra barra-b"></i>Despesas</span><span class="suave">últimos 6 meses</span></p><div id="barras" class="graf"></div></section>
    <section class="cartao c-linha" aria-labelledby="t-linha"><h2 id="t-linha">Ritmo de gastos</h2>
      <p class="chaves"><span><i class="amostra linha atual"></i>Este mês</span><span><i class="amostra linha anterior"></i>Mês anterior</span><span id="chave-limite"><i class="amostra limite"></i>Orçamento total</span></p><div id="linhas" class="graf"></div></section>
  </div>
  <section class="cartao" aria-labelledby="t-metas"><h2 id="t-metas">Metas de economia <button class="botao" id="nova-meta">+ Nova meta</button></h2><div id="metas" class="metas"></div></section>
  <section class="cartao" aria-labelledby="t-lanc"><h2 id="t-lanc">Lançamentos</h2>
    <div class="filtros">
      <div class="seg" role="group" aria-label="Tipo"><button data-tipo="todos" aria-pressed="true">Todos</button><button data-tipo="receita" aria-pressed="false">Receitas</button><button data-tipo="despesa" aria-pressed="false">Despesas</button></div>
      <label class="so-leitor" for="f-cat">Categoria</label><select id="f-cat"></select>
      <label class="so-leitor" for="f-busca">Buscar</label><input type="search" id="f-busca" placeholder="Buscar por descrição ou categoria" autocomplete="off">
      <label class="marcar"><input type="checkbox" id="f-todos"> Todos os meses</label>
    </div>
    <div id="tabela"></div>
  </section>
</main>
<footer class="rodape">Projeto de demonstração: os dados ficam só no seu navegador (<code>localStorage</code>), nada é enviado a servidor algum. Valores fictícios. <a href="https://github.com/luizrenatodc/financas-pessoais">Código no GitHub</a>.</footer>`;

// ---------------------------------------------------------------- toast e diálogo
let tToast;
function avisar(msg, { ruim = false, acao = null } = {}) {
  const el = $("#toast");
  el.className = "toast" + (ruim ? " ruim" : "");
  el.innerHTML = `<span>${esc(msg)}</span>${acao ? `<button class="botao sutil" id="toast-acao">${esc(acao.rotulo)}</button>` : ""}`;
  el.hidden = false;
  if (acao) $("#toast-acao").onclick = () => { acao.fn(); el.hidden = true; };
  clearTimeout(tToast);
  tToast = setTimeout(() => (el.hidden = true), acao ? 7000 : 4200);
}

function abrirDialogo(titulo, corpo, { ok = "Salvar", aoEnviar, largo = false, perigo = false } = {}) {
  const d = $("#dlg");
  d.className = largo ? "largo" : "";
  d.innerHTML = `<form class="dlg-form" novalidate><h2 id="dlg-titulo">${esc(titulo)}</h2>${corpo}<p class="erro" role="alert"></p>
    <div class="acoes"><button type="button" class="botao sutil" data-fechar>Cancelar</button><button class="botao ${perigo ? "perigo-cheio" : "primario"}">${esc(ok)}</button></div></form>`;
  $("form", d).addEventListener("submit", (e) => {
    e.preventDefault();
    const erro = aoEnviar($("form", d));
    if (erro) { $(".erro", d).textContent = erro; return; }
    d.close();
  });
  d.showModal();
  const primeiro = $("input:not([type=radio]):not([type=hidden]), select, textarea", d);
  primeiro?.focus();
}
$("#dlg").addEventListener("click", (e) => { if (e.target.closest("[data-fechar]") || e.target === e.currentTarget) e.currentTarget.close(); });

// ---------------------------------------------------------------- desenho
function desenharTudo() {
  desenharTopo();
  desenharAviso();
  desenharAlertas();
  desenharKPIs();
  desenharGraficos();
  desenharOrcamento();
  desenharMetas();
  desenharFiltros();
  desenharTabela();
}

function desenharTopo() {
  $("#mes-rotulo").textContent = nomeMes(ym);
  $("#mes-hoje").hidden = ym === mesDe(HOJE);
}

function desenharAviso() {
  $("#aviso-exemplo").innerHTML = dados.exemplo
    ? `<div class="banner info"><span><b>Dados de exemplo.</b> Tudo aqui é fictício e fica só neste navegador. Mexa à vontade.</span><button class="botao" data-acao="limpar">Começar do zero</button></div>` : "";
}

function desenharAlertas() {
  const linhasO = linhasOrcamento(dados.categorias, dados.lancamentos, ym, dados.orcamentos);
  const alertas = alertasOrcamento(linhasO);
  $("#alertas").innerHTML = alertas.map((a) => a.estado === "estourado"
    ? `<div class="banner perigo" role="status"><b>${esc(a.categoria)}:</b> orçamento estourado em ${moeda(a.excesso)} (${pct(a.pct)} do limite)</div>`
    : `<div class="banner atencao" role="status"><b>${esc(a.categoria)}:</b> ${pct(a.pct)} do limite já foi usado</div>`).join("");
}

function variacao(atual, anterior, invertido = false) {
  if (!anterior) return "";
  const v = (atual - anterior) / anterior;
  if (Math.abs(v) < 0.005) return '<small class="var">igual ao mês anterior</small>';
  const sobe = v > 0;
  const bom = invertido ? !sobe : sobe;
  return `<small class="var ${bom ? "bom" : "ruim"}">${sobe ? "▲" : "▼"} ${Math.abs(Math.round(v * 100))}% vs. mês anterior</small>`;
}

function desenharKPIs() {
  const r = resumoMes(dados.lancamentos, ym);
  const a = resumoMes(dados.lancamentos, somarMeses(ym, -1));
  $("#kpis").innerHTML = `
    <article class="kpi"><h3>Receitas</h3><p class="valor pos">${moeda(r.receitas)}</p>${variacao(r.receitas, a.receitas)}</article>
    <article class="kpi"><h3>Despesas</h3><p class="valor neg">${moeda(r.despesas)}</p>${variacao(r.despesas, a.despesas, true)}</article>
    <article class="kpi destaque"><h3>Saldo do mês</h3><p class="valor ${r.saldo >= 0 ? "pos" : "neg"}">${r.saldo > 0 ? "+" : ""}${moeda(r.saldo)}</p><small class="var">${r.quantidade} lançamento${r.quantidade === 1 ? "" : "s"}</small></article>
    <article class="kpi"><h3>Taxa de poupança</h3><p class="valor">${r.taxaPoupanca === null ? "—" : pct(r.taxaPoupanca)}</p><small class="var">${r.taxaPoupanca === null ? "sem receitas no mês" : r.taxaPoupanca >= 0.2 ? "acima da meta de 20%" : r.taxaPoupanca >= 0 ? "da receita sobrou" : "gastou mais do que ganhou"}</small></article>`;
}

let filtroLegenda = null;
function desenharGraficos() {
  // rosca
  const totais = totaisPorCategoria(dados.lancamentos, ym, "despesa");
  const fatias = agruparFatias(totais.map((t) => ({ rotulo: nomeCategoria(t.categoria), valor: t.total, cor: corCat(t.categoria), id: t.categoria })));
  const totalDesp = totais.reduce((s, t) => s + t.total, 0);
  const tam = Math.max(170, Math.min(230, $("#rosca").parentElement.clientWidth - 8 || 220));
  $("#rosca").innerHTML = rosca({ dados: fatias, tamanho: tam, titulo: `Despesas de ${nomeMes(ym)} por categoria`, rotuloCentro: "Despesas" });
  $("#legenda").innerHTML = totalDesp
    ? fatias.map((f) => `<li>${f.id
        ? `<button class="leg ${filtros.categoria === f.id ? "ativa" : ""}" data-cat="${esc(f.id)}" aria-pressed="${filtros.categoria === f.id}" title="Filtrar lançamentos desta categoria"><span class="ponto c${f.cor}"></span><span class="nome">${esc(f.rotulo)}</span><span class="v">${moeda(f.valor)}</span><span class="p">${pct(f.valor / totalDesp)}</span></button>`
        : `<div class="leg"><span class="ponto c-demais"></span><span class="nome">${esc(f.rotulo)}</span><span class="v">${moeda(f.valor)}</span><span class="p">${pct(f.valor / totalDesp)}</span></div>`}</li>`).join("")
    : '<li class="vazio">Sem despesas neste mês.</li>';

  // barras
  const larg = Math.max(300, $("#barras").clientWidth || 560);
  const serie = serieMensal(dados.lancamentos, ym, 6).map((s) => ({ rotulo: nomeMes(s.ym, true), a: s.receitas, b: s.despesas }));
  $("#barras").innerHTML = barras({ serie, largura: larg, altura: larg < 420 ? 220 : 260 });

  // linhas
  const dias = gastosAcumulados(dados.lancamentos, ym, HOJE);
  const ant = gastosAcumulados(dados.lancamentos, somarMeses(ym, -1));
  const anteriorAjustado = dias.map((_, i) => ant[Math.min(i, ant.length - 1)]);
  const limite = totalOrcado(dados.categorias, dados.orcamentos);
  $("#chave-limite").hidden = !limite;
  const lw = Math.max(300, $("#linhas").clientWidth || 560);
  $("#linhas").innerHTML = linhas({
    dias: dias.length,
    series: [{ nome: "Mês anterior", valores: anteriorAjustado, classe: "anterior" }, { nome: "Este mês", valores: dias, classe: "atual", marcador: true }],
    limite: limite ? { valor: limite, rotulo: `Orçamento ${moeda(limite)}` } : null,
    largura: lw, altura: lw < 420 ? 220 : 260,
  });
}

function desenharOrcamento() {
  const l = linhasOrcamento(dados.categorias, dados.lancamentos, ym, dados.orcamentos);
  if (!l.length) { $("#orcamento").innerHTML = '<p class="vazio">Defina limites por categoria para acompanhar o orçamento.</p>'; return; }
  const rotulo = { ok: "No ritmo", alerta: "Atenção", estourado: "Estourado", "sem-limite": "Sem limite" };
  $("#orcamento").innerHTML = `<ul class="orc">${l.map((x) => `
    <li class="orc-item ${x.estado}">
      <div class="orc-topo"><span>${pontoCat(x.categoria.id)}<b>${esc(x.categoria.nome)}</b></span><span class="selo ${x.estado}">${rotulo[x.estado]}</span></div>
      <progress max="${x.limite || 1}" value="${Math.min(x.gasto, x.limite || 1)}" class="${x.estado}" aria-label="${esc(x.categoria.nome)}: ${x.limite ? pct(x.pct) + " do limite" : "sem limite definido"}"></progress>
      <div class="orc-base"><span>${moeda(x.gasto)}${x.limite ? ` de ${moeda(x.limite)}` : ""}</span>
        <span class="suave">${x.estado === "sem-limite" ? "defina um limite" : x.restante >= 0 ? `restam ${moeda(x.restante)}` : `${moeda(-x.restante)} acima`}</span></div>
    </li>`).join("")}</ul>`;
}

function desenharMetas() {
  if (!dados.metas.length) { $("#metas").innerHTML = '<p class="vazio">Nenhuma meta ainda. Crie uma para acompanhar quanto falta.</p>'; return; }
  $("#metas").innerHTML = dados.metas.map((m) => {
    const p = progressoMeta(m, HOJE);
    let dica = "";
    if (p.concluida) dica = "Meta alcançada. Parabéns!";
    else if (p.atrasada) dica = `Prazo vencido em ${dataBR(m.prazo)}. Faltam ${moeda(p.falta)}.`;
    else if (p.aporteMensal !== null) dica = `Para chegar em ${dataBR(m.prazo)}, guarde ${moeda(p.aporteMensal)} por mês.`;
    else dica = "Sem prazo definido.";
    const ritmo = !p.concluida && p.previsao ? `No ritmo atual (${moeda(p.ritmoMensal)}/mês), você chega em ${nomeMes(p.previsao, true)}.` : !p.concluida ? "Sem aportes nos últimos 3 meses." : "";
    return `<article class="meta ${p.concluida ? "feita" : ""}" data-meta="${esc(m.id)}">
      <header><h3>${esc(m.nome)}</h3>${p.concluida ? '<span class="selo ok">Concluída</span>' : ""}</header>
      <p class="meta-valor"><b>${moeda(p.guardado)}</b> <span class="suave">de ${moeda(m.alvo)}</span></p>
      <progress max="100" value="${Math.round(p.pct * 100)}" class="${p.concluida ? "ok" : p.atrasada ? "estourado" : "m-prog"}" aria-label="${esc(m.nome)}: ${Math.round(p.pct * 100)}% da meta"></progress>
      <p class="meta-pct">${Math.round(p.pct * 100)}%${p.concluida ? "" : ` · faltam ${moeda(p.falta)}`}</p>
      <p class="dica">${esc(dica)}</p><p class="dica suave">${esc(ritmo)}</p>
      <div class="meta-acoes">
        <button class="botao" data-aporte="${esc(m.id)}">Guardar / retirar</button>
        <button class="icone" data-editar-meta="${esc(m.id)}" aria-label="Editar meta ${esc(m.nome)}">${iconeLapis}</button>
        <button class="icone" data-excluir-meta="${esc(m.id)}" aria-label="Excluir meta ${esc(m.nome)}">${iconeLixo}</button>
      </div></article>`;
  }).join("");
}

function desenharFiltros() {
  const sel = $("#f-cat");
  const anterior = filtros.categoria;
  sel.innerHTML = '<option value="">Todas as categorias</option>' + dados.categorias.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}${c.tipo === "receita" ? " (receita)" : ""}</option>`).join("");
  sel.value = anterior;
  $$("[data-tipo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tipo === filtros.tipo)));
  $("#f-todos").checked = filtros.todosMeses;
}

function desenharTabela() {
  const lista = filtrarLancamentos(dados.lancamentos, { ym: filtros.todosMeses ? null : ym, tipo: filtros.tipo, categoria: filtros.categoria, busca: filtros.busca }, nomes());
  if (!lista.length) {
    $("#tabela").innerHTML = `<p class="vazio">${dados.lancamentos.length ? "Nenhum lançamento com esses filtros." : "Nenhum lançamento ainda. Use “+ Lançamento” para começar."}</p>`;
    return;
  }
  const soma = lista.reduce((s, l) => s + (l.tipo === "receita" ? l.valor : -l.valor), 0);
  $("#tabela").innerHTML = `
    <div class="tabela-rolagem"><table class="lanc">
      <caption class="so-leitor">Lançamentos</caption>
      <thead><tr><th scope="col">Data</th><th scope="col">Descrição</th><th scope="col">Categoria</th><th scope="col" class="dir">Valor</th><th scope="col"><span class="so-leitor">Ações</span></th></tr></thead>
      <tbody>${lista.slice(0, 300).map((l) => `
        <tr>
          <td data-rotulo="Data">${dataBR(l.data).slice(0, 5)}<span class="ano">/${l.data.slice(0, 4)}</span></td>
          <td data-rotulo="Descrição" class="desc">${esc(l.descricao)}</td>
          <td data-rotulo="Categoria"><span class="chip">${pontoCat(l.categoria)}${esc(nomeCategoria(l.categoria))}</span></td>
          <td data-rotulo="Valor" class="dir val ${l.tipo === "receita" ? "pos" : "neg"}">${l.tipo === "receita" ? "+" : "−"} ${moeda(l.valor)}</td>
          <td class="acoes-linha">
            <button class="icone" data-editar="${esc(l.id)}" aria-label="Editar ${esc(l.descricao)}">${iconeLapis}</button>
            <button class="icone" data-excluir="${esc(l.id)}" aria-label="Excluir ${esc(l.descricao)}">${iconeLixo}</button>
          </td>
        </tr>`).join("")}</tbody></table></div>
    <p class="rodape-tabela">${lista.length} lançamento${lista.length === 1 ? "" : "s"}${lista.length > 300 ? " (mostrando os 300 mais recentes)" : ""} · resultado: <b class="${soma >= 0 ? "pos" : "neg"}">${soma >= 0 ? "+" : "−"} ${moeda(Math.abs(soma))}</b></p>`;
}

// ---------------------------------------------------------------- lançamentos
function dialogoLancamento(existente = null) {
  const l = existente ?? { tipo: "despesa", valor: 0, data: mesDe(HOJE) === ym ? HOJE : `${ym}-01`, categoria: "", descricao: "" };
  const opcoes = (tipo, sel) => dados.categorias.filter((c) => c.tipo === tipo).map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? "selected" : ""}>${esc(c.nome)}</option>`).join("") + '<option value="__nova__">+ Nova categoria…</option>';
  abrirDialogo(existente ? "Editar lançamento" : "Novo lançamento", `
    <fieldset class="seg grande"><legend class="so-leitor">Tipo</legend>
      <label><input type="radio" name="tipo" value="despesa" ${l.tipo === "despesa" ? "checked" : ""}><span>Despesa</span></label>
      <label><input type="radio" name="tipo" value="receita" ${l.tipo === "receita" ? "checked" : ""}><span>Receita</span></label></fieldset>
    <div class="dupla"><div><label for="l-valor">Valor (R$)</label><input id="l-valor" name="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${l.valor ? formatarNumero(l.valor).replace(/\./g, "") : ""}"></div>
    <div><label for="l-data">Data</label><input id="l-data" name="data" type="date" value="${l.data}"></div></div>
    <label for="l-cat">Categoria</label><select id="l-cat" name="categoria">${opcoes(l.tipo, l.categoria)}</select>
    <input id="l-nova" name="nova" placeholder="Nome da nova categoria" maxlength="40" hidden>
    <label for="l-desc">Descrição</label><input id="l-desc" name="descricao" maxlength="120" autocomplete="off" placeholder="Ex.: Supermercado" value="${esc(l.descricao)}">`, {
    ok: existente ? "Salvar" : "Adicionar",
    aoEnviar: (f) => {
      const tipo = f.tipo.value;
      const valor = lerValor(f.valor.value);
      let cat = f.categoria.value;
      if (cat === "__nova__") {
        if (!f.nova.value.trim()) return "Digite o nome da nova categoria.";
        cat = garantirCategoria(dados, f.nova.value, tipo);
      }
      const novo = { id: existente?.id ?? novoId(), tipo, valor: valor === null ? NaN : Math.abs(valor), data: f.data.value, categoria: cat, descricao: f.descricao.value.trim() };
      const erros = validarLancamento(novo);
      if (erros.length) return erros[0];
      if (existente) Object.assign(existente, novo); else dados.lancamentos.push(novo);
      persistir();
      if (mesDe(novo.data) !== ym) { ym = mesDe(novo.data); }
      desenharTudo();
      avisar(existente ? "Lançamento atualizado." : "Lançamento adicionado.");
    },
  });
  const d = $("#dlg");
  const recarregar = () => {
    const tipo = $("form", d).tipo.value;
    $("#l-cat").innerHTML = opcoes(tipo, "");
    $("#l-nova").hidden = true;
  };
  $$('input[name="tipo"]', d).forEach((r) => r.addEventListener("change", recarregar));
  $("#l-cat").addEventListener("change", (e) => { $("#l-nova").hidden = e.target.value !== "__nova__"; if (!$("#l-nova").hidden) $("#l-nova").focus(); });
}

function excluirLancamento(id) {
  const i = dados.lancamentos.findIndex((l) => l.id === id);
  if (i < 0) return;
  const [removido] = dados.lancamentos.splice(i, 1);
  ultimoExcluido = { item: removido, indice: i };
  persistir();
  desenharTudo();
  avisar(`“${removido.descricao}” excluído.`, { acao: { rotulo: "Desfazer", fn: () => { dados.lancamentos.splice(Math.min(i, dados.lancamentos.length), 0, removido); persistir(); desenharTudo(); } } });
}

// ---------------------------------------------------------------- orçamento
function dialogoLimites() {
  const cats = dados.categorias.filter((c) => c.tipo === "despesa");
  abrirDialogo("Limites mensais por categoria", `<p class="suave">Deixe em branco para não ter limite. O alerta acende ao passar de 80%.</p>
    <div class="limites">${cats.map((c) => `<label for="lim-${esc(c.id)}">${pontoCat(c.id)}${esc(c.nome)}</label><input id="lim-${esc(c.id)}" data-cat="${esc(c.id)}" inputmode="decimal" placeholder="sem limite" autocomplete="off" value="${dados.orcamentos[c.id] ? formatarNumero(dados.orcamentos[c.id]).replace(/\./g, "") : ""}">`).join("")}</div>`, {
    largo: true,
    aoEnviar: (f) => {
      const novos = {};
      for (const inp of $$("input[data-cat]", f)) {
        if (!inp.value.trim()) continue;
        const v = lerValor(inp.value);
        if (v === null || v <= 0) return `Valor inválido em ${nomeCategoria(inp.dataset.cat)}.`;
        novos[inp.dataset.cat] = v;
      }
      dados.orcamentos = novos;
      persistir();
      desenharTudo();
      avisar("Limites salvos.");
    },
  });
}

// ---------------------------------------------------------------- metas
function dialogoMeta(meta = null) {
  abrirDialogo(meta ? "Editar meta" : "Nova meta de economia", `
    <label for="m-nome">Nome da meta</label><input id="m-nome" name="nome" maxlength="60" autocomplete="off" placeholder="Ex.: Reserva de emergência" value="${esc(meta?.nome ?? "")}">
    <div class="dupla"><div><label for="m-alvo">Valor da meta (R$)</label><input id="m-alvo" name="alvo" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${meta ? formatarNumero(meta.alvo).replace(/\./g, "") : ""}"></div>
    <div><label for="m-prazo">Prazo (opcional)</label><input id="m-prazo" name="prazo" type="date" value="${meta?.prazo ?? ""}"></div></div>`, {
    aoEnviar: (f) => {
      const nome = f.nome.value.trim(), alvo = lerValor(f.alvo.value), prazo = f.prazo.value || null;
      if (!nome) return "Dê um nome à meta.";
      if (alvo === null || alvo <= 0) return "Informe um valor de meta maior que zero.";
      if (prazo && !dataValida(prazo)) return "Prazo inválido.";
      if (meta) Object.assign(meta, { nome, alvo, prazo }); else dados.metas.push({ id: novoId(), nome, alvo, prazo, aportes: [] });
      persistir();
      desenharMetas();
    },
  });
}

function dialogoAporte(meta) {
  const p = progressoMeta(meta, HOJE);
  abrirDialogo(`Guardar ou retirar — ${meta.nome}`, `
    <p class="suave">Guardado até agora: <b>${moeda(p.guardado)}</b> de ${moeda(meta.alvo)}.</p>
    <fieldset class="seg grande"><legend class="so-leitor">Operação</legend>
      <label><input type="radio" name="op" value="guardar" checked><span>Guardar</span></label><label><input type="radio" name="op" value="retirar"><span>Retirar</span></label></fieldset>
    <div class="dupla"><div><label for="a-valor">Valor (R$)</label><input id="a-valor" name="valor" inputmode="decimal" autocomplete="off" placeholder="0,00"></div>
    <div><label for="a-data">Data</label><input id="a-data" name="data" type="date" value="${HOJE}"></div></div>
    <p class="suave pequeno">Os aportes das metas são separados dos lançamentos: não alteram o saldo do mês.</p>`, {
    ok: "Registrar",
    aoEnviar: (f) => {
      const v = lerValor(f.valor.value);
      if (v === null || v <= 0) return "Informe um valor maior que zero.";
      if (!dataValida(f.data.value)) return "Data inválida.";
      meta.aportes.push({ id: novoId(), data: f.data.value, valor: f.op.value === "retirar" ? -v : v });
      persistir();
      desenharMetas();
      avisar(f.op.value === "retirar" ? "Retirada registrada." : "Aporte registrado.");
    },
  });
}

// ---------------------------------------------------------------- CSV
function baixar(nome, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportar(todos) {
  const lista = todos ? dados.lancamentos : dados.lancamentos.filter((l) => mesDe(l.data) === ym);
  if (!lista.length) return avisar("Não há lançamentos para exportar.", { ruim: true });
  baixar(todos ? "financas-tudo.csv" : `financas-${ym}.csv`, exportarCSV(lista, nomeCategoria));
  avisar(`${lista.length} lançamento${lista.length === 1 ? "" : "s"} exportado${lista.length === 1 ? "" : "s"}.`);
}

function previaImportacao(nomeArquivo, texto) {
  const { itens, erros } = importarCSV(texto);
  if (!itens.length) {
    abrirDialogo("Importar CSV", `<p class="erro-bloco">Nenhum lançamento válido em <b>${esc(nomeArquivo)}</b>.</p><ul class="lista-erros">${erros.slice(0, 6).map((e) => `<li>${e.linha ? `Linha ${e.linha}: ` : ""}${esc(e.motivo)}</li>`).join("")}</ul>
      <p class="suave pequeno">Colunas aceitas: data, valor (obrigatórias), tipo, categoria e descricao. Datas como 2026-11-05 ou 05/11/2026; valores como 1.234,56.</p>`, { ok: "Fechar", aoEnviar: () => null });
    return;
  }
  const chave = (x) => `${x.data}|${x.tipo}|${x.valor}|${x.descricao.toLowerCase()}|${slugCat(x.categoria)}`;
  const slugCat = (n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const existentes = new Set(dados.lancamentos.map((l) => chave({ ...l, categoria: nomeCategoria(l.categoria) })));
  const novos = itens.filter((i) => !existentes.has(chave(i)));
  const amostra = itens.slice(0, 4);
  abrirDialogo("Importar CSV", `
    <p><b>${itens.length}</b> lançamento${itens.length === 1 ? "" : "s"} válido${itens.length === 1 ? "" : "s"} em <b>${esc(nomeArquivo)}</b>${erros.length ? `, <b class="neg">${erros.length}</b> linha${erros.length === 1 ? "" : "s"} com problema` : ""}.
    ${itens.length - novos.length ? `<br><span class="suave">${itens.length - novos.length} já existem e serão ignorados.</span>` : ""}</p>
    <table class="previa"><tbody>${amostra.map((i) => `<tr><td>${dataBR(i.data)}</td><td>${esc(i.descricao)}</td><td>${esc(i.categoria)}</td><td class="dir ${i.tipo === "receita" ? "pos" : "neg"}">${i.tipo === "receita" ? "+" : "−"} ${moeda(i.valor)}</td></tr>`).join("")}</tbody></table>
    ${erros.length ? `<details><summary>Ver problemas</summary><ul class="lista-erros">${erros.slice(0, 8).map((e) => `<li>Linha ${e.linha}: ${esc(e.motivo)}</li>`).join("")}${erros.length > 8 ? `<li>… e mais ${erros.length - 8}</li>` : ""}</ul></details>` : ""}
    <fieldset class="opcoes"><legend class="so-leitor">Como importar</legend>
      <label><input type="radio" name="modo" value="somar" checked> Somar aos lançamentos atuais</label>
      <label><input type="radio" name="modo" value="trocar"> Substituir todos os lançamentos</label></fieldset>`, {
    ok: "Importar",
    aoEnviar: (f) => {
      if (f.modo.value === "trocar") { dados.lancamentos = []; dados.exemplo = false; }
      const vistos = new Set(dados.lancamentos.map((l) => chave({ ...l, categoria: nomeCategoria(l.categoria) })));
      let adicionados = 0;
      for (const i of itens) {
        if (vistos.has(chave(i))) continue;
        vistos.add(chave(i));
        dados.lancamentos.push({ id: novoId(), tipo: i.tipo, valor: i.valor, data: i.data, categoria: garantirCategoria(dados, i.categoria, i.tipo), descricao: i.descricao });
        adicionados++;
      }
      persistir();
      const recente = itens.map((i) => i.data).sort().at(-1);
      ym = mesDe(recente);
      desenharTudo();
      avisar(`${adicionados} lançamento${adicionados === 1 ? "" : "s"} importado${adicionados === 1 ? "" : "s"}.`);
    },
  });
}

// ---------------------------------------------------------------- eventos
document.addEventListener("click", (e) => {
  const t = e.target;
  const menu = $("#menu");
  if (menu.open && !t.closest("#menu")) menu.open = false;
  if (t.closest("#mes-ant")) { ym = somarMeses(ym, -1); return desenharTudo(); }
  if (t.closest("#mes-prox")) { ym = somarMeses(ym, 1); return desenharTudo(); }
  if (t.closest("#mes-hoje")) { ym = mesDe(HOJE); return desenharTudo(); }
  if (t.closest("#novo")) return dialogoLancamento();
  if (t.closest("#tema")) return alternarTema();
  if (t.closest("#editar-limites")) return dialogoLimites();
  if (t.closest("#nova-meta")) return dialogoMeta();
  const acao = t.closest("[data-acao]")?.dataset.acao;
  if (acao) {
    menu.open = false;
    if (acao === "exportar-mes") return exportar(false);
    if (acao === "exportar-tudo") return exportar(true);
    if (acao === "importar") return $("#arquivo-csv").click();
    if (acao === "exemplo") return abrirDialogo("Carregar dados de exemplo?", "<p>Isso substitui tudo o que está salvo neste navegador por dados fictícios.</p>", { ok: "Carregar exemplo", perigo: true, aoEnviar: () => { dados = gerarExemplo(HOJE); ym = mesInicial(); persistir(); desenharTudo(); avisar("Dados de exemplo carregados."); } });
    if (acao === "limpar") return abrirDialogo("Apagar todos os dados?", "<p>Lançamentos, limites e metas serão removidos deste navegador. Exporte um CSV antes se quiser guardar.</p>", { ok: "Apagar tudo", perigo: true, aoEnviar: () => { dados = dadosVazios(); ym = mesDe(HOJE); filtros.categoria = ""; filtros.busca = ""; $("#f-busca").value = ""; persistir(); desenharTudo(); avisar("Tudo apagado. Comece adicionando um lançamento."); } });
  }
  const tipo = t.closest("[data-tipo]");
  if (tipo) { filtros.tipo = tipo.dataset.tipo; desenharFiltros(); return desenharTabela(); }
  const leg = t.closest("button[data-cat]");
  if (leg && !t.closest("dialog")) {
    filtros.categoria = filtros.categoria === leg.dataset.cat ? "" : leg.dataset.cat;
    filtros.tipo = filtros.categoria ? "despesa" : "todos";
    desenharFiltros(); desenharTabela(); desenharGraficos();
    if (filtros.categoria) $("#t-lanc").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const ed = t.closest("[data-editar]");
  if (ed) return dialogoLancamento(dados.lancamentos.find((l) => l.id === ed.dataset.editar));
  const ex = t.closest("[data-excluir]");
  if (ex) return excluirLancamento(ex.dataset.excluir);
  const ap = t.closest("[data-aporte]");
  if (ap) return dialogoAporte(dados.metas.find((m) => m.id === ap.dataset.aporte));
  const em = t.closest("[data-editar-meta]");
  if (em) return dialogoMeta(dados.metas.find((m) => m.id === em.dataset.editarMeta));
  const xm = t.closest("[data-excluir-meta]");
  if (xm) {
    const m = dados.metas.find((x) => x.id === xm.dataset.excluirMeta);
    return abrirDialogo("Excluir meta?", `<p>A meta <b>${esc(m.nome)}</b> e seus aportes serão removidos.</p>`, { ok: "Excluir", perigo: true, aoEnviar: () => { dados.metas = dados.metas.filter((x) => x !== m); persistir(); desenharMetas(); } });
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "f-busca") { filtros.busca = e.target.value; desenharTabela(); }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "f-cat") { filtros.categoria = e.target.value; desenharGraficos(); desenharTabela(); }
  if (e.target.id === "f-todos") { filtros.todosMeses = e.target.checked; desenharTabela(); }
  if (e.target.id === "arquivo-csv" && e.target.files[0]) {
    const arquivo = e.target.files[0];
    if (arquivo.size > 5_000_000) { avisar("Arquivo grande demais (limite de 5 MB).", { ruim: true }); e.target.value = ""; return; }
    arquivo.text().then((texto) => previaImportacao(arquivo.name, texto)).catch(() => avisar("Não consegui ler o arquivo.", { ruim: true }));
    e.target.value = "";
  }
});
document.addEventListener("keydown", (e) => {
  const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "") || document.activeElement?.isContentEditable;
  if (e.key.toLowerCase() === "n" && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey && !$("#dlg").open) { e.preventDefault(); dialogoLancamento(); }
  if (e.key === "Escape" && $("#menu").open) $("#menu").open = false;
});

let tRedim;
let larguraAnterior = innerWidth;
new ResizeObserver(() => {
  clearTimeout(tRedim);
  tRedim = setTimeout(() => { if (Math.abs(innerWidth - larguraAnterior) > 4) { larguraAnterior = innerWidth; desenharGraficos(); } }, 120);
}).observe(document.body);
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", desenharGraficos);

desenharTudo();
requestAnimationFrame(() => desenharGraficos());
