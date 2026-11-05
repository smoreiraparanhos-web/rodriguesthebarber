// Datas e horas sempre no horário de Brasília, seja qual for o fuso do celular.
const FUSO = 'America/Sao_Paulo';

export const pad = (n) => String(n).padStart(2, '0');
export const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function agoraMinSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}
export const dataDe = (iso) => new Date(iso + 'T12:00:00Z');
export function somarDias(iso, n) {
  const d = dataDe(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const semanaDe = (iso) => dataDe(iso).getUTCDay();
export const fmt = (iso, opcoes) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opcoes }).format(dataDe(iso));
export const paraMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
export const paraHora = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
