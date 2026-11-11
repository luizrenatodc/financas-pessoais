// Datas como texto "AAAA-MM-DD" e meses como "AAAA-MM": sem fuso horário, sem surpresas.

const pad = (n) => String(n).padStart(2, "0");
export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function hojeISO(agora = new Date()) {
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}
export const mesDe = (iso) => iso.slice(0, 7);

export function dataValida(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return me >= 1 && me <= 12 && d >= 1 && d <= diasNoMes(`${m[1]}-${m[2]}`) && a >= 1900 && a <= 2200;
}

export function diasNoMes(ym) {
  const [a, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function somarMeses(ym, n) {
  const [a, m] = ym.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

/** Diferença em meses inteiros entre dois "AAAA-MM" (b - a). */
export function diferencaMeses(a, b) {
  const [aa, am] = a.split("-").map(Number);
  const [ba, bm] = b.split("-").map(Number);
  return (ba - aa) * 12 + (bm - am);
}

export function nomeMes(ym, curto = false) {
  const [a, m] = ym.split("-").map(Number);
  const nome = MESES[m - 1];
  return curto ? `${nome.slice(0, 3)}/${String(a).slice(2)}` : `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`;
}

/** "2026-11-05" -> "05/11/2026" */
export const dataBR = (iso) => iso.split("-").reverse().join("/");

/** Aceita "2026-11-05", "05/11/2026" e "5/11/26"; devolve ISO ou null. */
export function lerData(texto) {
  const t = String(texto ?? "").trim();
  let iso = null;
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) iso = `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t))) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    iso = `${ano}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  }
  return iso && dataValida(iso) ? iso : null;
}
