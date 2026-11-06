// Rodrigues TheBarber: abertura, galeria, avaliações e agendamento.

import { SUPABASE } from './config.js';

const API = 'https://rodrigues-painel-tiago.adeptcharm4.chatgpt.site/api/public';
const WHATSAPP = '5551994659011';
const FUSO = 'America/Sao_Paulo';
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

const $ = (sel, root = document) => root.querySelector(sel);

/* ---------- abertura ---------- */

// A sequência de entrada só começa com a fonte e a foto prontas,
// para o letreiro não trocar de fonte no meio da animação.
const heroImg = $('.arco img');
Promise.race([
  Promise.all([document.fonts?.ready, heroImg?.decode?.().catch(() => {})]),
  new Promise((r) => setTimeout(r, 900)),
]).then(() => document.documentElement.classList.add('pronto'));

const topo = $('#topo');
const progresso = $('#progresso');
let quadroPedido = false;
function aoRolar() {
  quadroPedido = false;
  topo.classList.toggle('rolou', scrollY > 24);
  const total = document.documentElement.scrollHeight - innerHeight;
  progresso.style.setProperty('--lido', total > 0 ? (scrollY / total).toFixed(4) : 0);
}
addEventListener('scroll', () => {
  if (!quadroPedido) { quadroPedido = true; requestAnimationFrame(aoRolar); }
}, { passive: true });
aoRolar();

// seções ganham .visivel uma vez, ao entrar na tela (régua dos títulos e animações de entrada)
const revelar = new IntersectionObserver((entradas) => {
  for (const e of entradas) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('visivel');
    revelar.unobserve(e.target);
  }
}, { threshold: 0.18 });
document.querySelectorAll('main section:not(.abertura)').forEach((s) => revelar.observe(s));

// o menu marca a seção que está no meio da tela
const linksMenu = [...document.querySelectorAll('.menu a')];
const espiao = new IntersectionObserver((entradas) => {
  for (const e of entradas) {
    if (!e.isIntersecting) continue;
    for (const a of linksMenu) {
      if (a.hash === '#' + e.target.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section').forEach((s) => espiao.observe(s));

$('#ano').textContent = new Date().getFullYear();

// o link "Privacidade" do rodapé abre o aviso que fica junto ao formulário
const privacidade = $('#privacidade');
const abrirPrivacidade = () => { if (location.hash === '#privacidade') privacidade.open = true; };
$('#link-privacidade').addEventListener('click', () => { privacidade.open = true; });
addEventListener('hashchange', abrirPrivacidade);
abrirPrivacidade();

/* ---------- cartão de horário ---------- */

// o exemplo do cartão aponta para o próximo sábado de verdade
{
  const hoje = new Date();
  const falta = ((6 - hoje.getDay() + 7) % 7) || 7;
  const sabado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + falta);
  $('#cartao-dia').textContent = `sábado, ${sabado.getDate()}/${String(sabado.getMonth() + 1).padStart(2, '0')}`;
}

// inclina o cartão na direção do ponteiro, com um reflexo que acompanha
const cartao = $('#cartao');
if (matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
  cartao.addEventListener('pointermove', (e) => {
    const r = cartao.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cartao.classList.add('seguindo');
    cartao.style.setProperty('--ry', `${(x - .5) * 10}deg`);
    cartao.style.setProperty('--rx', `${(.5 - y) * 8}deg`);
    cartao.style.setProperty('--gx', `${x * 100}%`);
    cartao.style.setProperty('--gy', `${y * 100}%`);
  });
  cartao.addEventListener('pointerleave', () => {
    cartao.classList.remove('seguindo');
    for (const p of ['--rx', '--ry']) cartao.style.setProperty(p, '0deg');
  });
}

/* ---------- galeria ---------- */

const fotos = [
  ['corte-08', 'Platinado com degradê nas laterais'],
  ['corte-02', 'Freestyle sendo desenhado na lateral'],
  ['corte-05', 'Corte infantil com risca lateral'],
  ['corte-04', 'Cabelo grisalho penteado com barba branca aparada'],
  ['corte-07', 'Cachos no topo com laterais baixas'],
  ['corte-09', 'Barba cheia grisalha alinhada'],
  ['corte-06', 'Degradê com franja longa, vista de lado'],
  ['corte-11', 'Degradê baixo com barba curta'],
  ['corte-03', 'Degradê com topo curto'],
  ['corte-10', 'Degradê com barba desenhada'],
  ['corte-12', 'Degradê com topo texturizado, vista de lado'],
  ['corte-01', 'Corte baixo com barba cheia'],
];

const galeria = $('#galeria');
galeria.innerHTML = fotos.map(([nome, alt], i) => `
  <li>
    <button type="button" data-foto="${nome}" data-indice="${i}" data-legenda="${alt}" aria-label="Ampliar foto: ${alt}">
      <img src="img/${nome}-480.webp" srcset="img/${nome}-480.webp 480w, img/${nome}-900.webp 900w"
        sizes="(min-width: 760px) 25vw, 50vw" width="480" height="600" alt="${alt}"
        loading="lazy" decoding="async">
    </button>
  </li>`).join('');

// no celular a galeria começa com 6 fotos; o botão mostra as outras
const galeriaToda = $('#galeria-toda');
galeriaToda.addEventListener('click', () => {
  galeria.classList.remove('recolhida');
  galeriaToda.setAttribute('aria-expanded', 'true');
  galeriaToda.hidden = true;
  galeria.querySelector('li:nth-child(7) button')?.focus({ preventScroll: true });
});

// borda impressa do filme e películas que correm em sentidos opostos ao rolar
const trabalhos = $('#trabalhos');
const peliculas = [...document.querySelectorAll('.pelicula')];
for (const [i, p] of peliculas.entries()) {
  $('.pelicula-txt', p).textContent = Array.from({ length: 40 }, (_, n) =>
    `RODRIGUES THEBARBER 400 ▸ ${String(n * 2 + 1 + i).padStart(2, '0')}${n % 2 ? 'A' : ''}`).join('     ');
}
if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  let visivelGaleria = false;
  let pedido = false;
  const mover = () => {
    pedido = false;
    const r = trabalhos.getBoundingClientRect();
    const d = (innerHeight - r.top) * .18;
    peliculas[0].style.setProperty('--x', `${-d}px`);
    peliculas[1].style.setProperty('--x', `${d - 200}px`);
  };
  new IntersectionObserver(([e]) => { visivelGaleria = e.isIntersecting; if (visivelGaleria) mover(); }).observe(trabalhos);
  addEventListener('scroll', () => {
    if (visivelGaleria && !pedido) { pedido = true; requestAnimationFrame(mover); }
  }, { passive: true });
}

const dialogo = $('#foto-grande');
const fotoGrande = $('img', dialogo);
const legenda = $('.foto-legenda', dialogo);
const conta = $('.foto-conta', dialogo);
let atual = 0;
let origem = null;

function mostrarFoto(i, lado = 0) {
  atual = (i + fotos.length) % fotos.length;
  const [nome, alt] = fotos[atual];
  const trocar = () => {
    fotoGrande.src = `img/${nome}-900.webp`;
    fotoGrande.alt = alt;
    legenda.textContent = alt;
    conta.textContent = `${atual + 1} de ${fotos.length}`;
  };
  if (!lado || matchMedia('(prefers-reduced-motion: reduce)').matches) return trocar();
  // sai para um lado e a próxima entra pelo outro
  fotoGrande.style.setProperty('--lado', `${-lado * 14}px`);
  fotoGrande.classList.add('trocando');
  setTimeout(() => {
    trocar();
    fotoGrande.style.setProperty('--lado', `${lado * 14}px`);
    fotoGrande.decode().catch(() => {}).finally(() => requestAnimationFrame(() => fotoGrande.classList.remove('trocando')));
  }, 160);
}

galeria.addEventListener('click', (e) => {
  const botao = e.target.closest('button[data-foto]');
  if (!botao) return;
  origem = botao;
  mostrarFoto(Number(botao.dataset.indice));
  dialogo.showModal();
});
$('.seta-ant', dialogo).addEventListener('click', () => mostrarFoto(atual - 1, -1));
$('.seta-prox', dialogo).addEventListener('click', () => mostrarFoto(atual + 1, 1));
$('.fechar', dialogo).addEventListener('click', () => dialogo.close());
dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
dialogo.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') mostrarFoto(atual + 1, 1);
  if (e.key === 'ArrowLeft') mostrarFoto(atual - 1, -1);
});
dialogo.addEventListener('close', () => origem?.focus());

// arrastar para o lado no celular troca a foto
let toqueX = null;
dialogo.addEventListener('touchstart', (e) => { toqueX = e.touches[0].clientX; }, { passive: true });
dialogo.addEventListener('touchend', (e) => {
  if (toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX;
  toqueX = null;
  if (Math.abs(dx) > 50) mostrarFoto(atual + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
});

/* ---------- avaliações (transcritas do Google) ---------- */

const avaliacoes = [
  ['João Vitor', 'O atendimento do Tiago foi excepcional. Ele me recebeu com um sorriso e foi extremamente atencioso durante todo o processo. Fez perguntas sobre o que eu queria e me deu sugestões úteis. O corte ficou exatamente como eu imaginava!'],
  ['Nino Matheus', 'Excelente!! Nunca mais cortei o cabelo em outro lugar.'],
  ['Lukas Leopoldo', 'Profissional extremamente caprichoso, detalhista, serviço impecável. E o atendimento é top, com certeza virei mais um cliente.'],
  ['Vitor Frazão', 'Eu vivo em Portugal, e enquanto estive fora não encontrei tamanha técnica e profissionalismo. Obrigado mais uma vez pelo excelente trabalho!!!'],
  ['Hoberdã Camargo Oliveira', 'O Tiago é top no que faz, trabalho de qualidade superior!! Com ele até os feios ficam bonitos.'],
  ['Jefferson Costa', 'Super recomendo, atendimento impecável, ótimo profissional, super atencioso. Muito top.'],
  ['Rafael Santos', 'Excelente profissional, sou cliente há mais de 3 anos.'],
  ['Marcelo Ullrich', 'Muito bom atendimento, um bom profissional, sabe muito.'],
  ['Harold Ignacio Leyva Benitez', 'Ótimo serviço de 10 estrelas!!'],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

$('#depos').innerHTML = avaliacoes.map(([nome, texto]) => `
  <li>
    <span class="estrelas" role="img" aria-label="5 estrelas">★★★★★</span>
    <p>${esc(texto)}</p>
    <footer class="depo-autor"><cite>${esc(nome)}</cite><span class="depo-fonte">Google</span></footer>
  </li>`).join('');

/* ---------- aberto agora ---------- */

function agoraSP() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday);
  return { semana, minuto: Number(partes.hour) * 60 + Number(partes.minute) };
}

// placa da porta, régua do dia e contagem até fechar ou abrir
const placa = $('#placa');
const barraDia = $('.dia-barra');

// horário de cada dia da semana (0 = domingo), em minutos; o banco do painel pode substituir
let semanaHoras = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ aberto: true, abre: 9 * 60, fecha: d === 0 ? 12 * 60 : 20 * 60 }));
let diasFechados = [];
const hh = (min) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
const DIAS_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function hojeSPIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function horasDoDia(semana, deslocamento = 0) {
  const d = new Date(hojeSPIso() + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + deslocamento);
  const h = semanaHoras[semana];
  return (!h || !h.aberto || diasFechados.includes(d.toISOString().slice(0, 10))) ? null : h;
}
// próxima abertura a partir de amanhã, em texto ("amanhã às 9h", "segunda às 9h")
function proximaAbertura(semana) {
  for (let n = 1; n <= 7; n++) {
    const w = (semana + n) % 7;
    const h = horasDoDia(w, n);
    if (h) return `${n === 1 ? 'amanhã' : DIAS_NOME[w]} às ${hh(h.abre)}`;
  }
  return 'em breve';
}

function statusAberto() {
  const { semana, minuto } = agoraSP();
  const hoje = horasDoDia(semana);
  const abre = hoje ? hoje.abre : 0;
  const fecha = hoje ? hoje.fecha : 0;
  const aberto = !!hoje && minuto >= abre && minuto < fecha;
  const antesDeAbrir = !!hoje && minuto < abre;
  const proxima = antesDeAbrir ? `hoje às ${hh(abre)}` : proximaAbertura(semana);
  const el = $('#aberto');

  if (aberto) {
    const falta = fecha - minuto;
    const h = Math.floor(falta / 60);
    const m = falta % 60;
    el.textContent = `Fecha em ${h ? `${h}h ` : ''}${m ? `${m}min` : ''}`.trim();
  } else {
    el.textContent = `Abre ${proxima}`;
  }
  el.classList.toggle('fechado', !aberto);
  const faixa = $('#faixa-status');
  faixa.textContent = aberto ? `Aberto agora, até as ${hh(fecha)}` : `Fechado, abre ${proxima}`;
  faixa.classList.toggle('aberto-agora', aberto);
  placa.classList.toggle('aberta', aberto);
  $('#placa-txt').textContent = aberto ? 'Aberto' : 'Fechado';
  $('#placa-sub').textContent = aberto ? `até as ${hh(fecha)}` : `abre ${proxima.replace(/^(hoje|amanhã) às /, 'às ')}`;

  const p = hoje ? Math.min(1, Math.max(0, (minuto - abre) / (fecha - abre))) : 0;
  barraDia.style.setProperty('--p', p.toFixed(4));
  barraDia.classList.toggle('fechada', !aberto);
  const base = hoje || semanaHoras.find((x) => x.aberto) || { abre: 540, fecha: 1200 };
  const passos = [0, 1 / 3, 2 / 3, 1].map((f) => Math.round((base.abre + (base.fecha - base.abre) * f) / 60) * 60);
  $('#dia-marcas').innerHTML = [...new Set(passos)].map((x) => `<span>${hh(x)}</span>`).join('');

  for (const tr of document.querySelectorAll('.horas tr[data-semana]')) {
    tr.classList.toggle('hoje', tr.dataset.semana.split(',').includes(String(semana)));
  }
}

// reescreve a tabela de horário e o rodapé com o horário do banco
function mostrarHorario() {
  const grupos = [];
  for (const w of [1, 2, 3, 4, 5, 6, 0]) {
    const h = semanaHoras[w];
    const chave = h.aberto ? `${h.abre}-${h.fecha}` : 'fechado';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === chave) ultimo.dias.push(w);
    else grupos.push({ chave, dias: [w], h });
  }
  const nomeGrupo = (dias) => {
    const nome = (w) => DIAS_NOME[w][0].toUpperCase() + DIAS_NOME[w].slice(1);
    return dias.length === 1 ? nome(dias[0]) : `${nome(dias[0])} a ${DIAS_NOME[dias[dias.length - 1]]}`;
  };
  const texto = (g) => (g.h.aberto ? `${hh(g.h.abre)} às ${hh(g.h.fecha)}` : 'Fechado');
  $('.horas tbody').innerHTML = grupos.map((g) =>
    `<tr data-semana="${g.dias.join(',')}"><th scope="row">${esc(nomeGrupo(g.dias))}</th><td>${esc(texto(g))}</td></tr>`).join('');
  const rodape = document.getElementById('rodape-horario');
  if (rodape) rodape.innerHTML = grupos.map((g) => `${esc(nomeGrupo(g.dias))}, ${esc(texto(g).toLowerCase())}`).join('<br>');
}
statusAberto();
setInterval(statusAberto, 30000);

/* ---------- rosa dos ventos ---------- */

$('#rosa-marcas').innerHTML = Array.from({ length: 64 }, (_, i) => {
  const maior = i % 8 === 0;
  return `<line class="${maior ? 'maior' : ''}" y1="-96" y2="${maior ? -88 : -92}" transform="rotate(${i * 5.625})"/>`;
}).join('');

// a agulha aponta para o mapa; com o ponteiro na seção, segue o ponteiro como ímã
const rosa = $('#rosa');
const agulha = $('#rosa-agulha');
const endereco = $('#endereco');
let rumo = 90;
function apontar(graus) {
  rumo += ((((graus - rumo) % 360) + 540) % 360) - 180;
  agulha.style.setProperty('--r', `${rumo}deg`);
}
function apontarParaMapa() {
  const a = rosa.getBoundingClientRect();
  const m = $('.mapa').getBoundingClientRect();
  const dx = (m.left + m.width / 2) - (a.left + a.width / 2);
  const dy = (m.top + m.height / 2) - (a.top + a.height / 2);
  apontar(Math.atan2(dx, -dy) * 180 / Math.PI);
}
if (matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
  endereco.addEventListener('pointermove', (e) => {
    const a = rosa.getBoundingClientRect();
    apontar(Math.atan2(e.clientX - (a.left + a.width / 2), -(e.clientY - (a.top + a.height / 2))) * 180 / Math.PI);
  });
  endereco.addEventListener('pointerleave', apontarParaMapa);
}
apontarParaMapa();
addEventListener('resize', apontarParaMapa, { passive: true });

// passar o ponteiro ou tocar na placa faz ela balançar de novo
const balancarPlaca = () => {
  placa.classList.remove('tocada');
  void placa.offsetWidth;
  placa.classList.add('tocada');
};
placa.addEventListener('pointerenter', balancarPlaca);
placa.addEventListener('click', balancarPlaca);

/* ---------- barra fixa de agendamento no celular ---------- */

const barra = $('#barra-agendar');
const visiveis = new Set();
const observador = new IntersectionObserver((entradas) => {
  for (const e of entradas) e.isIntersecting ? visiveis.add(e.target.id) : visiveis.delete(e.target.id);
  // aparece fora da abertura e some quando o formulário ou o rodapé já estão na tela
  barra.classList.toggle('mostrar', !['inicio', 'agendar', 'rodape'].some((id) => visiveis.has(id)));
}, { threshold: 0.05 });
observador.observe($('#inicio'));
observador.observe($('#agendar'));
observador.observe($('#rodape'));

/* ---------- relógio de parede da agenda ---------- */

const relogio = $('#relogio');
$('#relogio-marcas').innerHTML = Array.from({ length: 60 }, (_, i) => {
  const hora = i % 5 === 0;
  return `<line class="${hora ? 'hora' : ''}" y1="${hora ? -88 : -86}" y2="-82" transform="rotate(${i * 6})"/>`;
}).join('');

const ponteiros = { h: $('#ponteiro-hora'), m: $('#ponteiro-min'), s: $('#ponteiro-seg') };
const angulos = { h: 0, m: 0, s: 0 };
let horaMarcada = '';

// os ângulos só crescem, para os ponteiros nunca girarem de volta pelo caminho longo
function girar(nome, alvo) {
  const atual = angulos[nome];
  angulos[nome] = atual + ((((alvo - atual) % 360) + 360) % 360);
  ponteiros[nome].style.setProperty('--a', `${angulos[nome]}deg`);
}

function horaSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, Number(x.value)]));
  return [p.hour, p.minute, p.second];
}

function tique() {
  if (horaMarcada) return;
  const [h, m, s] = horaSP();
  girar('s', s * 6);
  girar('m', m * 6 + s * .1);
  girar('h', (h % 12) * 30 + m * .5);
}

// chamado sempre que o horário escolhido na ficha muda
function relogioMostrar(hora) {
  if (hora === horaMarcada) return;
  const voltando = horaMarcada && !hora;
  horaMarcada = hora;
  relogio.classList.toggle('marcado', !!hora);
  if (hora) {
    const [h, m] = hora.split(':').map(Number);
    girar('m', m * 6);
    girar('h', (h % 12) * 30 + m * .5);
  } else if (voltando) {
    relogio.classList.add('voltando');
    tique();
    setTimeout(() => relogio.classList.remove('voltando'), 1500);
  }
}

let relogioTimer = 0;
new IntersectionObserver(([e]) => {
  clearInterval(relogioTimer);
  if (e.isIntersecting) { tique(); relogioTimer = setInterval(tique, 1000); }
}).observe(relogio);
tique();

/* ---------- agendamento ---------- */

const ficha = $('#ficha');
const servico = $('#servico');
const dias = $('#dias');
const mes = $('#mes');
const semanaAnt = $('#semana-ant');
const semanaProx = $('#semana-prox');
const horarios = $('#horarios');
const horariosStatus = $('#horarios-status');
const resumo = $('#resumo');
const enviar = $('#enviar');
const aviso = $('#aviso');
const telefone = $('#telefone');
const telefoneErro = $('#telefone-erro');

const estado = { servicos: {}, catalogo: [], ativo: true, antecedencia: 60, dia: '', hora: '', enviando: false };
// identificador do pedido; celulares antigos sem randomUUID usam getRandomValues
const novoId = () => crypto.randomUUID?.() ??
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
let pedidoId = novoId();
let consulta = 0;

const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const somarDias = (dia, n) => {
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmt = (dia, opcoes) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opcoes }).format(new Date(dia + 'T12:00:00Z'));
const diaPorExtenso = (dia) => fmt(dia, { weekday: 'long', day: 'numeric', month: 'long' });

let chamarApi = async (caminho, corpo) => {
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 20000);
  try {
    const resp = await fetch(API + caminho, {
      method: corpo ? 'POST' : 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: corpo ? { 'Content-Type': 'application/json' } : {},
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
    let dados;
    try { dados = await resp.json(); } catch { throw new Error('Não foi possível acessar a agenda.'); }
    if (!resp.ok) throw new Error(dados.error || 'Não foi possível concluir.');
    return dados;
  } finally {
    clearTimeout(limite);
  }
};

// banco do painel (Supabase): mesmas respostas da agenda antiga, pelas funções públicas do banco
async function chamarSupabase(caminho, corpo) {
  const url = new URL(caminho, 'https://site.local');
  let funcao, args;
  if (url.pathname === '/services') { funcao = 'servicos_publicos'; args = {}; }
  else if (url.pathname === '/availability') {
    funcao = 'disponibilidade';
    args = { p_dia: url.searchParams.get('day'), p_servico: url.searchParams.get('service') };
  } else if (url.pathname === '/appointments' && corpo) {
    funcao = 'solicitar_agendamento';
    args = {
      p_request_id: corpo.requestId, p_nome: corpo.name, p_telefone: corpo.phone, p_servico: corpo.service,
      p_dia: corpo.day, p_hora: corpo.time, p_observacao: corpo.notes || '', p_website: corpo.website || '',
    };
  } else throw new Error('Não foi possível concluir.');

  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 20000);
  const cabecalhos = { apikey: SUPABASE.chave, 'Content-Type': 'application/json' };
  // a chave antiga (anon) é um JWT e também vai no Authorization; a nova (sb_publishable_) não
  if (SUPABASE.chave.startsWith('eyJ')) cabecalhos.Authorization = `Bearer ${SUPABASE.chave}`;
  try {
    const resp = await fetch(`${SUPABASE.url.replace(/\/$/, '')}/rest/v1/rpc/${funcao}`, {
      method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store',
      headers: cabecalhos, body: JSON.stringify(args), signal: controle.signal,
    });
    let dados;
    try { dados = await resp.json(); } catch { throw new Error('Não foi possível acessar a agenda.'); }
    if (!resp.ok) throw new Error(dados?.message || 'Não foi possível concluir.');
    return dados;
  } finally {
    clearTimeout(limite);
  }
}

// preços vindos do painel: reescreve a "Tabela da casa" mantendo o visual e os ícones
const reais = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
function mostrarPrecos(catalogo) {
  if (!Array.isArray(catalogo) || !catalogo.length) return;
  const grupos = [...document.querySelectorAll('.quadro-grupo')];
  for (const g of grupos) {
    const categoria = g.querySelector('h3').textContent.trim();
    const itens = catalogo.filter((s) => s.categoria === categoria);
    g.hidden = !itens.length;
    g.querySelector('dl').innerHTML = itens.map((s) => `
      <div${s.destaque ? ' class="favorito"' : ''}><dt>${esc(s.nome)}${s.detalhe ? ` <small>${esc(s.detalhe)}</small>` : ''}</dt>${
        s.preco == null ? '<dd class="combinar">a combinar</dd>' : `<dd>${reais(s.preco)}</dd>`}</div>`).join('');
  }
  const ritual = document.querySelector('.ritual');
  const combo = catalogo.find((s) => s.categoria === 'Combo');
  ritual.hidden = !combo;
  if (combo) {
    ritual.querySelector('h3').textContent = combo.nome;
    ritual.querySelector('div p').textContent = combo.detalhe || '';
    ritual.querySelector('.ritual-preco').innerHTML = combo.preco == null
      ? 'a combinar' : `<span>R$</span>${esc(reais(combo.preco).replace('R$ ', ''))}`;
  }
}

// mensagem do pedido para o WhatsApp da barbearia, com negrito, itálico e uma informação por linha.
// Sem emojis: o WhatsApp no computador troca os emojis que vêm pelo link por "�".
const horaFalada = (h) => h.replace(':00', 'h').replace(':', 'h');
// link que só a barbearia usa: abre o painel direto neste pedido (cliente vê "Acesso negado")
const linkPainel = (numero) => new URL(`painel/#p${numero}`, location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '')).href;
function textoPedido({ servicoNome, dia, hora, nome, obs, numero, confirmado }) {
  const item = estado.catalogo.find((s) => s.nome === servicoNome);
  const duracao = estado.servicos[servicoNome];
  const linhas = ['*RODRIGUES THEBARBER*', '_Pedido de agendamento pelo site_', ''];
  if (servicoNome) linhas.push(`*Serviço:* ${servicoNome}`);
  if (dia) linhas.push(`*Dia:* ${diaPorExtenso(dia)}`);
  if (hora) linhas.push(`*Horário:* ${horaFalada(hora)}`);
  if (duracao) linhas.push(`*Duração:* ${duracao} min`);
  if (item) linhas.push(`*Valor:* ${item.preco == null ? 'a combinar' : reais(item.preco)}`);
  linhas.push('');
  if (nome) linhas.push(`*Cliente:* ${nome}`);
  if (obs) linhas.push(`*Obs.:* ${obs}`);
  linhas.push('');
  const situacao = confirmado ? 'horário reservado' : 'aguardando confirmação';
  linhas.push(numero ? `Pedido nº ${String(numero).padStart(4, '0')} · ${situacao}` : situacao[0].toUpperCase() + situacao.slice(1));
  if (numero) linhas.push(`_Só para a barbearia:_ ${linkPainel(numero)}`);
  return linhas.join('\n');
}
const linkWhatsApp = (texto) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;

// quando o pedido não foi registrado no site, o cliente ainda pode pedir direto pelo WhatsApp
function mensagemWhatsApp() {
  return linkWhatsApp(textoPedido({
    servicoNome: servico.value, dia: estado.dia, hora: estado.hora, nome: $('#nome').value.trim(), obs: $('#mensagem').value.trim(),
  }).replace('_Pedido de agendamento pelo site_', '_Quero agendar um horário_'));
}

function mostrarAviso(tipo, titulo, texto, comWhatsApp = false) {
  aviso.hidden = false;
  aviso.className = `aviso ${tipo}`;
  aviso.innerHTML = `<h3>${esc(titulo)}</h3><p>${esc(texto)}</p>` +
    (comWhatsApp ? `<p><a class="link-ouro" href="${esc(mensagemWhatsApp())}" target="_blank" rel="noopener noreferrer">Pedir o horário pelo WhatsApp</a></p>` : '');
}

// pedido registrado: último passo é enviar a mensagem pronta ao WhatsApp da barbearia
function mostrarEnvioWhatsApp(pedido, numero, confirmado) {
  const texto = textoPedido({ servicoNome: pedido.service, dia: pedido.day, hora: pedido.time, nome: pedido.name, obs: pedido.notes.trim(), numero, confirmado });
  aviso.hidden = false;
  aviso.className = 'aviso ok';
  aviso.innerHTML = `<h3>${confirmado ? 'Horário reservado!' : 'Falta só um passo'}</h3>
    <p>${confirmado ? 'Agora envie a mensagem no WhatsApp para avisar o Tiago:' : 'Envie o pedido no WhatsApp da barbearia para o Tiago receber agora:'}</p>
    <p><a class="botao botao-ouro botao-wpp" href="${esc(linkWhatsApp(texto))}" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/></svg>Enviar no WhatsApp</a></p>
    <p class="aviso-resumo">${esc(pedido.service)}, ${esc(diaPorExtenso(pedido.day))}, às ${esc(pedido.time)}. ${confirmado
      ? 'Se precisar mudar algo, o Tiago te chama no WhatsApp.' : 'O horário fica reservado quando o Tiago confirmar.'}</p>`;
}

function atualizarResumo() {
  const pronto = servico.value && estado.dia && estado.hora;
  resumo.innerHTML = pronto
    ? `<strong>${esc(servico.value)}</strong>, ${esc(diaPorExtenso(estado.dia))}, às <strong>${esc(estado.hora)}</strong>.`
    : '';
  enviar.disabled = !pronto || estado.enviando || !estado.ativo;
  relogioMostrar(estado.hora);
}

// grupo de opções em que só uma pode ficar marcada, navegável pelas setas
function marcar(grupo, botao) {
  for (const b of grupo.querySelectorAll('.chip')) {
    const sim = b === botao;
    b.setAttribute('aria-checked', String(sim));
    b.tabIndex = sim ? 0 : -1;
  }
}
function setas(grupo) {
  grupo.addEventListener('keydown', (e) => {
    const lista = [...grupo.querySelectorAll('.chip:not(:disabled)')];
    const i = lista.indexOf(document.activeElement);
    if (i < 0) return;
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!passo) return;
    e.preventDefault();
    const alvo = lista[(i + passo + lista.length) % lista.length];
    alvo.focus();
    alvo.click();
  });
}
setas(dias);
setas(horarios);

// uma semana por vez, de hoje até o limite de antecedência da agenda
let semana = 0;

function desenharDias(lado = 0) {
  const hoje = hojeSP();
  const inicio = semana * 7;
  const lista = Array.from({ length: 7 }, (_, i) => somarDias(hoje, inicio + i))
    .filter((_, i) => inicio + i <= estado.antecedencia);
  dias.innerHTML = lista.map((dia) => {
    const sem = dia === hoje ? 'hoje' : fmt(dia, { weekday: 'short' }).replace('.', '');
    const marcado = dia === estado.dia;
    return `<button type="button" class="chip" role="radio" aria-checked="${marcado}" tabindex="-1" data-dia="${dia}" aria-label="${esc(diaPorExtenso(dia))}">
      <span class="chip-sem">${esc(sem)}</span><span class="chip-dia">${fmt(dia, { day: 'numeric' })}</span>
    </button>`;
  }).join('');
  (dias.querySelector('[aria-checked="true"]') || dias.querySelector('.chip'))?.setAttribute('tabindex', '0');

  const meses = [...new Set(lista.map((d) => fmt(d, { month: 'long' })))];
  mes.textContent = meses.join(' e ');
  semanaAnt.disabled = semana === 0;
  semanaProx.disabled = inicio + 7 > estado.antecedencia;

  if (lado) {
    dias.style.setProperty('--lado', lado);
    dias.classList.remove('trocando');
    void dias.offsetWidth;
    dias.classList.add('trocando');
  }
}

semanaAnt.addEventListener('click', () => { semana--; desenharDias(-1); });
semanaProx.addEventListener('click', () => { semana++; desenharDias(1); });

function escolherDia(dia) {
  estado.dia = dia;
  marcar(dias, dias.querySelector(`[data-dia="${dia}"]`));
  buscarHorarios();
}

dias.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-dia]');
  if (chip) escolherDia(chip.dataset.dia);
});

servico.addEventListener('change', buscarHorarios);

async function buscarHorarios() {
  const minha = ++consulta;
  estado.hora = '';
  atualizarResumo();
  if (!servico.value || !estado.dia) {
    livres = []; desenharHorarios();
    horariosStatus.textContent = !servico.value ? 'Escolha o serviço.' : 'Escolha o dia.';
    return;
  }
  periodos.hidden = true;
  horarios.innerHTML = '<div class="carregando" aria-hidden="true"></div>';
  horariosStatus.textContent = 'Consultando a agenda…';
  try {
    const dados = await chamarApi(`/availability?day=${encodeURIComponent(estado.dia)}&service=${encodeURIComponent(servico.value)}`);
    if (minha !== consulta) return;
    if (!dados.enabled) {
      livres = []; desenharHorarios();
      horariosStatus.textContent = 'Os pedidos pelo site estão pausados no momento. Fale com o Tiago pelo WhatsApp.';
      return;
    }
    livres = dados.slots;
    const comHorario = PERIODOS.filter((p) => livres.some(p.tem));
    if (!comHorario.some((p) => p.nome === periodo)) periodo = comHorario[0]?.nome;
    desenharHorarios();
    horariosStatus.textContent = livres.length ? '' : 'Nenhum horário livre neste dia.';
  } catch (erro) {
    if (minha !== consulta) return;
    livres = []; desenharHorarios();
    horariosStatus.textContent = erro.name === 'AbortError'
      ? 'A agenda demorou para responder. Escolha o dia de novo para tentar outra vez.'
      : 'Não foi possível consultar a agenda. Escolha o dia de novo para tentar outra vez.';
  }
}

// os horários livres aparecem por período, para a lista não ficar enorme
const PERIODOS = [
  { nome: 'Manhã', tem: (h) => h < '12:00' },
  { nome: 'Tarde', tem: (h) => h >= '12:00' && h < '18:00' },
  { nome: 'Noite', tem: (h) => h >= '18:00' },
];
const periodos = $('#periodos');
let livres = [];
let periodo = 'Manhã';

function desenharHorarios() {
  periodos.hidden = !livres.length;
  periodos.innerHTML = PERIODOS.map((p) => {
    const n = livres.filter(p.tem).length;
    return `<button type="button" class="periodo" data-periodo="${p.nome}" aria-pressed="${p.nome === periodo}" ${n ? '' : 'disabled'}>${p.nome}<span>${n}</span></button>`;
  }).join('');
  const tem = PERIODOS.find((p) => p.nome === periodo)?.tem || (() => false);
  horarios.innerHTML = livres.filter(tem).map((h, i) =>
    `<button type="button" class="chip" role="radio" aria-checked="${h === estado.hora}" tabindex="${i === 0 ? 0 : -1}" data-hora="${esc(h)}" style="--i:${Math.min(i, 18)}">${esc(h)}</button>`).join('');
}

periodos.addEventListener('click', (e) => {
  const botao = e.target.closest('[data-periodo]');
  if (!botao || botao.disabled) return;
  periodo = botao.dataset.periodo;
  desenharHorarios();
});

horarios.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-hora]');
  if (!chip) return;
  marcar(horarios, chip);
  estado.hora = chip.dataset.hora;
  atualizarResumo();
});

function telefoneValido() {
  const limpo = telefone.value.replace(/\D/g, '');
  return /^(?:55)?[1-9]\d\d{8,9}$/.test(limpo);
}
telefone.addEventListener('blur', () => {
  if (!telefone.value) return;
  const ok = telefoneValido();
  telefoneErro.hidden = ok;
  telefone.setAttribute('aria-invalid', String(!ok));
});
telefone.addEventListener('input', () => {
  if (telefone.getAttribute('aria-invalid') === 'true' && telefoneValido()) {
    telefoneErro.hidden = true;
    telefone.setAttribute('aria-invalid', 'false');
  }
});

ficha.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (estado.enviando) return;
  const nome = $('#nome');
  if (!nome.value.trim()) {
    nome.setAttribute('aria-invalid', 'true');
    nome.focus();
    return;
  }
  nome.removeAttribute('aria-invalid');
  if (!telefoneValido()) {
    telefoneErro.hidden = false;
    telefone.setAttribute('aria-invalid', 'true');
    telefone.focus();
    return;
  }
  if (!servico.value || !estado.dia || !estado.hora) return;

  const pedido = {
    requestId: pedidoId,
    name: nome.value.trim(),
    phone: telefone.value,
    service: servico.value,
    day: estado.dia,
    time: estado.hora,
    notes: $('#mensagem').value,
    website: $('#website').value,
  };

  estado.enviando = true;
  enviar.disabled = true;
  enviar.classList.add('enviando');
  enviar.textContent = 'Enviando pedido…';
  aviso.hidden = true;
  try {
    const resposta = await chamarApi('/appointments', pedido);
    if (!resposta.received) throw new Error('O envio não foi confirmado. Tente de novo.');
    mostrarEnvioWhatsApp(pedido, Number.isInteger(resposta.id) ? resposta.id : null, resposta.status === 'confirmed');
    ficha.reset();
    pedidoId = novoId();
    estado.dia = '';
    estado.hora = '';
    semana = 0;
    desenharDias();
    livres = []; desenharHorarios();
    horariosStatus.textContent = 'Escolha o serviço e o dia.';
    aviso.focus();
  } catch (erro) {
    const texto = erro.name === 'AbortError'
      ? 'A conexão demorou. Você pode enviar de novo: o pedido não será duplicado.'
      : erro.message;
    mostrarAviso('falha', 'O pedido não foi enviado', texto, true);
    if (/ocupado/.test(texto)) buscarHorarios();
  } finally {
    estado.enviando = false;
    enviar.classList.remove('enviando');
    enviar.textContent = 'Solicitar horário';
    atualizarResumo();
  }
});

async function iniciarAgenda() {
  const usarBanco = SUPABASE.url && SUPABASE.chave;
  if (LOCAL && !new URLSearchParams(location.search).has('banco')) {
    // No computador de quem desenvolve, usa uma agenda simulada:
    // nenhum pedido de teste chega ao painel do Tiago. (Para testar o banco de verdade, abra com ?banco)
    chamarApi = (await import('./agenda-simulada.js')).chamarApi;
  } else if (usarBanco) {
    chamarApi = chamarSupabase;
  }
  desenharDias();
  try {
    const dados = await chamarApi('/services');
    estado.servicos = dados.services;
    estado.ativo = dados.enabled;
    estado.antecedencia = dados.advanceDays || 60;
    if (dados.catalogo) { estado.catalogo = dados.catalogo; mostrarPrecos(dados.catalogo); }
    if (Array.isArray(dados.horario) && dados.horario.length === 7) {
      const min = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
      semanaHoras = dados.horario.map((h) => ({ aberto: h.aberto, abre: min(h.abre), fecha: min(h.fecha) }));
      diasFechados = dados.fechados || [];
      mostrarHorario();
      statusAberto();
    }
    desenharDias();
    servico.innerHTML = '<option value="">Escolha o serviço</option>' +
      Object.entries(dados.services).map(([nome, min]) => `<option value="${esc(nome)}">${esc(nome)} · ${min} min</option>`).join('');
    servico.disabled = false;
    if (!dados.enabled) {
      mostrarAviso('falha', 'Agenda pausada', 'Os pedidos pelo site estão pausados no momento. Fale com o Tiago pelo WhatsApp.', true);
    }
  } catch {
    servico.innerHTML = '<option value="">Agenda indisponível</option>';
    mostrarAviso('falha', 'A agenda não carregou', 'Recarregue a página em instantes ou peça seu horário direto ao Tiago.', true);
  }
}
iniciarAgenda();
