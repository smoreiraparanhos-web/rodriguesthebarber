// Painel da Rodrigues TheBarber: login, Hoje, Pedidos, Agenda e Ajustes.

import { SUPABASE } from '../js/config.js';
import { criarDados } from './dados.js';
import { criarDemo } from './dados-demo.js';
import { hojeSP, agoraMinSP, somarDias, semanaDe, fmt, paraMin, paraHora } from './tempo.js';

const parametros = new URLSearchParams(location.search);
const DEMO = parametros.has('demo') || !SUPABASE.url || !SUPABASE.chave;
const dados = DEMO ? criarDemo() : criarDados(SUPABASE);

const ATIVOS = ['pendente', 'confirmado', 'chegou'];
const CATEGORIAS = ['Cortes', 'Barba e alinhamento', 'Pigmentação', 'Luzes e cor', 'Combo'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEMANA_LONGA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DURACOES = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];

let S = null;          // dados carregados do banco
let eu = null;         // { email, nome, papel }
let tela = 'hoje';
let diaAgenda = null;

const raiz = document.getElementById('raiz');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const real = (v) => (v == null ? 'a combinar' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`);
const primeiroNome = (n) => String(n).trim().split(/\s+/)[0];
const horaFalada = (h) => h.replace(':00', 'h').replace(':', 'h');

function diaExtenso(dia) {
  const n = Math.round((Date.parse(dia) - Date.parse(hojeSP())) / 864e5);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return fmt(dia, { weekday: 'long', day: 'numeric', month: 'numeric' });
}
const servicoDe = (nome) => S.servicos.find((s) => s.nome === nome);
const precoDe = (a) => a.preco ?? servicoDe(a.servico)?.preco ?? 0;

function expediente(dia) {
  if (S.fechados.some((f) => f.dia === dia)) return null;
  const h = S.horario.find((x) => x.dia_semana === semanaDe(dia));
  return h && h.aberto ? { abre: paraMin(h.abre), fecha: paraMin(h.fecha) } : null;
}

// horários livres de um dia para uma duração, no mesmo passo usado pelo site
function livres(dia, minutos, ignorarId) {
  const e = expediente(dia);
  if (!e) return [];
  const passo = S.config.passo_min || 30;
  const ocupado = [
    ...S.agendamentos.filter((a) => a.dia === dia && ATIVOS.includes(a.status) && a.id !== ignorarId)
      .map((a) => [paraMin(a.hora), paraMin(a.hora) + a.duracao_min]),
    ...S.bloqueios.filter((b) => b.dia === dia).map((b) => [paraMin(b.hora), paraMin(b.hora) + b.duracao_min]),
  ];
  let inicio = e.abre;
  if (dia === hojeSP()) while (inicio < agoraMinSP() - passo) inicio += passo;
  const res = [];
  for (let m = inicio; m + minutos <= e.fecha; m += passo) {
    if (!ocupado.some(([a, b]) => m < b && m + minutos > a)) res.push(paraHora(m));
  }
  return res;
}

function linkWhatsApp(telefone, texto) {
  let d = String(telefone || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

/* ===================== entrada e acesso ===================== */

async function iniciar() {
  document.getElementById('faixa-demo').hidden = !DEMO;
  try {
    const sessao = await dados.sessao();
    if (!sessao) return telaLogin();
    eu = await dados.papel();
    if (!eu) return telaNegado(sessao.user?.email);
    await recarregar();
    montarApp();
    ligarAoVivo();
  } catch (e) {
    telaErro(e);
  }
}

function telaLogin() {
  raiz.innerHTML = `
  <div class="casca"><section class="login">
    <span class="monograma" aria-hidden="true">R</span>
    <div>
      <h1>Painel da <em>Rodrigues TheBarber</em></h1>
      <p class="sub">Área privada para administrar a agenda. Só a conta do Tiago e a do suporte conseguem entrar.</p>
    </div>
    <button class="botao cheio" id="entrar">Entrar com a conta Google</button>
    <p class="nota">Use a mesma conta Google cadastrada no painel. Qualquer outra conta vê "Acesso negado".</p>
  </section></div>`;
  document.getElementById('entrar').onclick = async (e) => {
    if (DEMO) return escolherContaDemo();
    e.currentTarget.setAttribute('aria-busy', 'true');
    const { error } = await dados.entrar();
    if (error) { toast('Não foi possível abrir o login do Google. Tente de novo.'); e.currentTarget.removeAttribute('aria-busy'); }
  };
}

function escolherContaDemo() {
  const conta = (id, ini, txt, cor = 'var(--ouro)') => `<button class="botao fantasma cheio" data-conta="${id}" style="justify-content:flex-start">
    <span class="av" style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:1px solid ${cor};font-size:.8rem">${ini}</span>${txt}</button>`;
  abrirFolha(`
    <h2>Escolha a conta</h2>
    <p class="nota">Na demonstração, você escolhe quem está entrando. Com o banco ligado, aparece o login do Google.</p>
    <div class="acoes">${conta('dono', 'TR', 'Conta do Tiago (dono)')}${conta('suporte', 'SP', 'Conta do suporte')}${conta('outra', '?', 'Outra conta Google qualquer', 'var(--linha)')}</div>`, (f) => {
    f.querySelectorAll('[data-conta]').forEach((b) => b.onclick = async () => {
      fecharFolha();
      await dados.entrar(b.dataset.conta);
      iniciar();
    });
  });
}

function telaNegado(email) {
  raiz.innerHTML = `
  <div class="casca"><section class="negado">
    <svg class="cadeado" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/></svg>
    <h1>Acesso negado</h1>
    <p>A conta <b>${esc(email || '')}</b> não tem permissão para abrir o painel.</p>
    <p class="nota">Só a conta do Tiago e a do suporte entram. Se você é o Tiago, entre com a conta Google cadastrada.</p>
    <button class="botao linha" id="trocar">Entrar com outra conta</button>
  </section></div>`;
  document.getElementById('trocar').onclick = async () => { await dados.sair(); telaLogin(); };
}

function telaErro(e) {
  raiz.innerHTML = `
  <div class="casca"><section class="erro-tela">
    <h1 style="font-family:var(--serif);font-style:italic;font-size:1.8rem">O painel não abriu</h1>
    <p>${esc(e?.message || 'Erro desconhecido.')}</p>
    <button class="botao" id="tentar">Tentar de novo</button>
  </section></div>`;
  document.getElementById('tentar').onclick = () => location.reload();
}

/* ===================== dados ao vivo ===================== */

async function recarregar() {
  S = await dados.carregar(somarDias(hojeSP(), -1));
}

let recargaPendente = 0;
function recarregarDepois() {
  clearTimeout(recargaPendente);
  recargaPendente = setTimeout(async () => {
    try { await recarregar(); desenharSeguro(); } catch { /* tenta de novo na próxima */ }
  }, 400);
}

function ligarAoVivo() {
  dados.ouvir((tipo, a) => {
    if (tipo === 'INSERT' && a?.status === 'pendente' && a?.origem === 'site') notificar(a);
    recarregarDepois();
  });
  setInterval(() => { if (!document.hidden) recarregarDepois(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recarregarDepois(); });
}

function notificar(a) {
  toast(`Pedido novo: ${primeiroNome(a.nome)}, ${diaExtenso(a.dia)} às ${a.hora}`);
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification('Pedido novo pelo site', { body: `${a.nome} · ${a.servico} · ${diaExtenso(a.dia)} às ${a.hora}`, icon: 'icone-192.png' });
    }
  } catch { /* alguns celulares só avisam com o painel aberto */ }
}

// executa uma mudança, registra no histórico, recarrega e avisa
async function executar(botao, fn, { sucesso, log } = {}) {
  botao?.setAttribute('aria-busy', 'true');
  try {
    await fn();
    if (log) await dados.registrar(log).catch(() => {});
    await recarregar();
    desenhar();
    if (sucesso) toast(sucesso);
    return true;
  } catch (e) {
    toast(e.message || 'Não deu certo. Tente de novo.');
    return false;
  } finally {
    botao?.removeAttribute('aria-busy');
  }
}

/* ===================== app ===================== */

function montarApp() {
  raiz.innerHTML = `
  <div class="casca">
    <header class="topo">
      <span class="monograma" aria-hidden="true">R</span>
      <div class="topo-titulo"><b>Painel</b><small>${esc(eu.nome)} · ${esc(eu.papel)}</small></div>
      <button class="sair" id="sair">Sair</button>
    </header>
    <main>
      <section class="tela" id="t-hoje"></section>
      <section class="tela" id="t-pedidos" hidden></section>
      <section class="tela" id="t-agenda" hidden></section>
      <section class="tela" id="t-ajustes" hidden></section>
    </main>
  </div>
  <nav class="abas" aria-label="Seções do painel"><div class="abas-in">
    ${aba('hoje', 'Hoje', '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')}
    ${aba('pedidos', 'Pedidos', '<path d="M4 6.5h16v11H4z"/><path d="m4 7 8 6 8-6"/>')}
    ${aba('agenda', 'Agenda', '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>')}
    ${aba('ajustes', 'Ajustes', '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>')}
  </div></nav>`;
  document.getElementById('sair').onclick = async () => { await dados.sair(); eu = null; S = null; telaLogin(); };
  document.querySelectorAll('.aba').forEach((b) => b.onclick = () => { tela = b.dataset.tela; desenhar(); scrollTo(0, 0); });
  desenhar();
}
const aba = (id, nome, svg) => `<button class="aba" data-tela="${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>${nome}<span class="selo" id="selo-${id}" hidden></span></button>`;

function atualizarSelo() {
  const pend = S.agendamentos.filter((a) => a.status === 'pendente').length;
  const selo = document.getElementById('selo-pedidos');
  if (!selo) return;
  selo.hidden = !pend;
  selo.textContent = pend;
}

function desenhar() {
  if (!document.getElementById('t-hoje')) return;
  for (const t of ['hoje', 'pedidos', 'agenda', 'ajustes']) {
    document.getElementById('t-' + t).hidden = t !== tela;
    const b = document.querySelector(`.aba[data-tela="${t}"]`);
    if (t === tela) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  atualizarSelo();
  ({ hoje: desenharHoje, pedidos: desenharPedidos, agenda: desenharAgenda, ajustes: desenharAjustes })[tela]();
}

// não redesenha por baixo de uma folha aberta nem de um campo sendo editado
function desenharSeguro() {
  const editando = document.activeElement?.closest?.('#t-ajustes');
  if (veu || editando) atualizarSelo();
  else desenhar();
}

const rotStatus = { pendente: 'Aguardando', confirmado: 'Confirmado', chegou: 'Atendido', faltou: 'Faltou', cancelado: 'Cancelado', recusado: 'Recusado' };
const chip = (s) => `<span class="chip s-${s === 'recusado' ? 'cancelado' : s}">${rotStatus[s]}</span>`;

/* ---------- Hoje ---------- */
function desenharHoje() {
  const hoje = hojeSP();
  const lista = S.agendamentos.filter((a) => a.dia === hoje && !['cancelado', 'recusado'].includes(a.status)).sort((a, b) => a.hora.localeCompare(b.hora));
  const recebido = lista.filter((a) => a.status === 'chegou').reduce((t, a) => t + precoDe(a), 0);
  const previsto = lista.filter((a) => ['chegou', 'confirmado'].includes(a.status)).reduce((t, a) => t + precoDe(a), 0);
  const faltas = lista.filter((a) => a.status === 'faltou').length;
  const agora = agoraMinSP();
  const prox = lista.find((a) => a.status === 'confirmado' && paraMin(a.hora) + 20 >= agora);
  const e = expediente(hoje);
  const livresHoje = livres(hoje, 45).length;
  const h = Math.floor(agora / 60);
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

  document.getElementById('t-hoje').innerHTML = `
    <div class="cabeca">
      <p class="rotulo">${SEMANA_LONGA[semanaDe(hoje)]}, ${fmt(hoje, { day: 'numeric', month: 'numeric' })}</p>
      <h1>${saudacao}, ${esc(eu.nome)}</h1>
      <p>${e ? `Aberto das ${paraHora(e.abre)} às ${paraHora(e.fecha)}.` : 'A barbearia está fechada hoje.'}</p>
    </div>
    <div class="resumo">
      <div><b>${lista.filter((a) => a.status !== 'faltou').length}</b><small>clientes hoje</small></div>
      <div><b>${real(recebido)}</b><small>recebido de ${real(previsto)} previstos</small></div>
      <div><b>${livresHoje}</b><small>horários livres${faltas ? ` · ${faltas} falta${faltas > 1 ? 's' : ''}` : ''}</small></div>
    </div>
    ${prox ? `<div class="proximo">
      <p class="rotulo">Próximo cliente</p>
      <p class="hora">${prox.hora}</p>
      <p class="nome">${esc(prox.nome)}</p>
      <p class="serv">${esc(prox.servico)} · ${prox.duracao_min} min · ${real(precoDe(prox))}</p>
    </div>` : ''}
    ${e ? '<button class="botao linha cheio" id="encaixe">+ Encaixar cliente</button>' : ''}
    <div class="lista">${lista.length ? lista.map(itemHoje).join('') : '<p class="vazio">Nenhum cliente marcado para hoje.</p>'}</div>`;

  document.getElementById('encaixe')?.addEventListener('click', () => folhaEncaixe(hoje));
  document.querySelectorAll('#t-hoje [data-acao]').forEach((b) => b.onclick = () => acao(b.dataset.acao, +b.dataset.id, b));
}

function itemHoje(a) {
  const fim = a.status === 'chegou' || a.status === 'faltou';
  let acoes;
  if (a.status === 'confirmado') acoes = `<div class="item-acoes">
      <button class="botao peq" data-acao="chegou" data-id="${a.id}">Chegou</button>
      <button class="botao peq perigo" data-acao="faltou" data-id="${a.id}">Faltou</button>
      <button class="botao peq fantasma" data-acao="remarcar" data-id="${a.id}">Remarcar</button></div>`;
  else if (a.status === 'pendente') acoes = `<div class="item-acoes duas">
      <button class="botao peq" data-acao="confirmar" data-id="${a.id}">Confirmar</button>
      <button class="botao peq fantasma" data-acao="recusar" data-id="${a.id}">Recusar</button></div>`;
  else acoes = `<div class="item-acoes duas"><button class="botao peq fantasma" data-acao="desfazer" data-id="${a.id}">Desfazer</button></div>`;
  return `<article class="item ${fim ? 'apagado' : ''}">
    <div class="item-topo">
      <span class="item-hora">${a.hora}</span>
      <button class="item-corpo" data-acao="ver" data-id="${a.id}" style="background:none;border:0;padding:0;text-align:left">
        <b>${esc(a.nome)}</b><small>${esc(a.servico)} · ${a.duracao_min} min · ${real(precoDe(a))}</small><span class="origem">marcou pelo ${esc(a.origem)}</span>
      </button>
      ${chip(a.status)}
    </div>${acoes}</article>`;
}

function acao(qual, id, botao) {
  const a = S.agendamentos.find((x) => x.id === id);
  if (!a) return;
  const quem = `${a.nome} (${diaExtenso(a.dia)} ${a.hora})`;
  if (qual === 'chegou') return executar(botao, () => dados.atualizarAgendamento(id, { status: 'chegou' }), { sucesso: `${primeiroNome(a.nome)} atendido · ${real(precoDe(a))}`, log: `marcou ${quem} como atendido` });
  if (qual === 'faltou') return executar(botao, () => dados.atualizarAgendamento(id, { status: 'faltou' }), { sucesso: 'Falta registrada', log: `registrou falta de ${quem}` });
  if (qual === 'desfazer') return executar(botao, () => dados.atualizarAgendamento(id, { status: 'confirmado' }), { log: `desfez o registro de ${quem}` });
  if (qual === 'remarcar') return folhaRemarcar(a);
  if (qual === 'confirmar') return confirmar(a, botao);
  if (qual === 'recusar') return folhaRecusar(a);
  if (qual === 'ver') return folhaCliente(a);
}

/* ---------- Pedidos ---------- */
function desenharPedidos() {
  const pend = S.agendamentos.filter((a) => a.status === 'pendente').sort((a, b) => (a.dia + a.hora).localeCompare(b.dia + b.hora));
  document.getElementById('t-pedidos').innerHTML = `
    <div class="cabeca">
      <h1>Pedidos do site</h1>
      <p>${pend.length ? `${pend.length} pedido${pend.length > 1 ? 's' : ''} esperando sua resposta. O horário só fica reservado para o cliente depois de confirmar.` : 'Tudo respondido.'}</p>
    </div>
    ${S.config.recebendo ? '' : '<p class="vazio">Os pedidos pelo site estão pausados. Reative em Ajustes.</p>'}
    <div class="lista">${pend.length ? pend.map(itemPedido).join('') : '<p class="vazio">Nenhum pedido novo. Quando chegar um, ele aparece aqui na hora.</p>'}</div>`;
  document.querySelectorAll('#t-pedidos [data-acao]').forEach((b) => b.onclick = () => acao(b.dataset.acao, +b.dataset.id, b));
}
function itemPedido(a) {
  const min = Math.max(1, Math.round((Date.now() - a.criado) / 60000));
  const ha = min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dia(s)`;
  const passou = a.dia < hojeSP() || (a.dia === hojeSP() && paraMin(a.hora) < agoraMinSP());
  return `<article class="item">
    <div class="item-topo">
      <div class="item-corpo">
        <b>${esc(a.nome)}</b>
        <small>${esc(a.servico)} · ${a.duracao_min} min · ${real(precoDe(a))}</small>
        <small><strong style="color:${passou ? 'var(--erro)' : 'var(--ouro-claro)'}">${diaExtenso(a.dia)}, às ${a.hora}${passou ? ' (já passou)' : ''}</strong></small>
        ${a.observacao ? `<small>"${esc(a.observacao)}"</small>` : ''}
        <span class="origem">pelo site ${ha} · ${esc(a.telefone)}</span>
      </div>${chip(a.status)}
    </div>
    <div class="item-acoes duas">
      <button class="botao peq" data-acao="confirmar" data-id="${a.id}">Confirmar</button>
      <button class="botao peq fantasma" data-acao="recusar" data-id="${a.id}">Recusar</button>
    </div></article>`;
}

async function confirmar(a, botao) {
  const ok = await executar(botao, () => dados.atualizarAgendamento(a.id, { status: 'confirmado' }),
    { log: `confirmou ${a.nome} (${a.servico}, ${diaExtenso(a.dia)} às ${a.hora})` });
  if (ok) folhaMensagem('Horário confirmado', a,
    `Olá, ${primeiroNome(a.nome)}! Seu horário na Rodrigues TheBarber está confirmado: ${a.servico}, ${diaExtenso(a.dia)} às ${horaFalada(a.hora)}.\nEndereço: Av. Nestor Jardim Filho, 402.\nSe precisar remarcar, é só responder aqui. Até lá!`);
}

function proximoLivre(a) {
  for (let n = 0; n < 14; n++) {
    const dia = somarDias(hojeSP(), n);
    const l = livres(dia, a.duracao_min, a.id).filter((h) => !(dia === a.dia && h === a.hora));
    if (l.length) return { dia, hora: l[0] };
  }
  return null;
}

function folhaRecusar(a) {
  const motivos = [['ocupado', 'Já tenho cliente nesse horário'], ['fora', 'Não vou atender nesse dia'], ['outro', 'Outro motivo']];
  const sugestao = proximoLivre(a);
  abrirFolha(`
    <h2>Recusar o pedido de ${esc(primeiroNome(a.nome))}</h2>
    <p class="nota">${esc(a.servico)}, ${diaExtenso(a.dia)} às ${a.hora}</p>
    <div class="opcoes" id="motivo" role="group" aria-label="Motivo">${motivos.map(([k, t], i) => `<button class="op" data-v="${k}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div>
    ${sugestao ? `<p class="nota">A mensagem já oferece o próximo horário livre: <b style="color:var(--texto)">${diaExtenso(sugestao.dia)} às ${sugestao.hora}</b>.</p>` : ''}
    <div class="acoes">
      <button class="botao perigo cheio" id="ok">Recusar e preparar mensagem</button>
      <button class="botao fantasma cheio" data-fechar>Voltar</button>
    </div>`, (f) => {
    let motivo = 'ocupado';
    escolha(f.querySelector('#motivo'), (v) => motivo = v);
    f.querySelector('#ok').onclick = async (ev) => {
      const ok = await executar(ev.currentTarget, () => dados.atualizarAgendamento(a.id, { status: 'recusado' }), { log: `recusou o pedido de ${a.nome} (${diaExtenso(a.dia)} ${a.hora})` });
      if (!ok) return;
      const txt = { ocupado: 'Esse horário já está ocupado.', fora: 'Não vou atender nesse dia.', outro: 'Não vou conseguir nesse horário.' }[motivo];
      folhaMensagem('Pedido recusado', a, `Olá, ${primeiroNome(a.nome)}! ${txt}` +
        (sugestao ? ` Tenho horário ${diaExtenso(sugestao.dia)} às ${horaFalada(sugestao.hora)}. Quer que eu reserve para você?` : ' Me diga outro dia que te encaixo.'));
    };
  });
}

/* ---------- Agenda ---------- */
function desenharAgenda() {
  const hoje = hojeSP();
  const dias = Array.from({ length: 14 }, (_, i) => somarDias(hoje, i));
  if (!dias.includes(diaAgenda)) diaAgenda = hoje;
  const dia = diaAgenda;
  const e = expediente(dia);
  const fechadoManual = S.fechados.some((f) => f.dia === dia);
  const doDia = S.agendamentos.filter((a) => a.dia === dia && ATIVOS.includes(a.status));
  const passo = S.config.passo_min || 30;
  let grade = '';
  if (e) {
    const agora = dia === hoje ? agoraMinSP() : -1;
    for (let m = e.abre; m < e.fecha;) {
      const a = doDia.find((x) => paraMin(x.hora) >= m && paraMin(x.hora) < m + passo);
      const b = S.bloqueios.find((x) => x.dia === dia && paraMin(x.hora) >= m && paraMin(x.hora) < m + passo);
      if (a) {
        const cls = a.status === 'pendente' ? 'pend' : a.status === 'chegou' ? 'feito' : '';
        grade += `<button class="slot marcado ${cls}" data-ag="${a.id}"><span class="h">${a.hora}</span><span class="t"><b>${esc(a.nome)}</b><small>${esc(a.servico)} · até ${paraHora(paraMin(a.hora) + a.duracao_min)}</small></span>${chip(a.status)}</button>`;
        m = Math.max(m + passo, e.abre + Math.ceil((paraMin(a.hora) + a.duracao_min - e.abre) / passo) * passo);
      } else if (b) {
        grade += `<button class="slot bloq" data-bloq="${b.id}"><span class="h">${b.hora}</span><span class="t">Bloqueado · ${esc(b.motivo)} · até ${paraHora(paraMin(b.hora) + b.duracao_min)}</span></button>`;
        m = Math.max(m + passo, e.abre + Math.ceil((paraMin(b.hora) + b.duracao_min - e.abre) / passo) * passo);
      } else {
        const passado = agora >= 0 && m + passo <= agora;
        grade += `<button class="slot livre ${passado ? 'passado' : ''}" data-livre="${paraHora(m)}" ${passado ? 'disabled' : ''}><span class="h">${paraHora(m)}</span><span class="t"></span></button>`;
        m += passo;
      }
    }
  }
  const semanaDias = dias.slice(diaAgendaSemana(dias, dia) * 7, diaAgendaSemana(dias, dia) * 7 + 7);
  document.getElementById('t-agenda').innerHTML = `
    <div class="cabeca"><h1>Agenda</h1><p>Toque num horário livre para encaixar um cliente ou bloquear.</p></div>
    <div class="quando-semana" style="display:flex;gap:.5rem;align-items:center">
      <button class="botao peq fantasma" id="sem-ant" aria-label="Semana anterior" ${semanaDias[0] === dias[0] ? 'disabled' : ''}>‹</button>
      <div class="dias" style="flex:1">${semanaDias.map((d) => {
        const tem = S.agendamentos.some((a) => a.dia === d && ATIVOS.includes(a.status));
        return `<button class="dia ${expediente(d) ? '' : 'fechado'}" data-dia="${d}" aria-pressed="${d === dia}" aria-label="${SEMANA_LONGA[semanaDe(d)]} ${fmt(d, { day: 'numeric' })}"><small>${d === hoje ? 'hoje' : SEMANA[semanaDe(d)]}</small><b>${fmt(d, { day: 'numeric' })}</b><i class="${tem ? 'tem' : ''}"></i></button>`;
      }).join('')}</div>
      <button class="botao peq fantasma" id="sem-prox" aria-label="Próxima semana" ${semanaDias[6] === dias[13] ? 'disabled' : ''}>›</button>
    </div>
    <p class="rotulo">${fmt(dia, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <div class="grade">${e ? grade : `<p class="vazio">${fechadoManual ? 'Você fechou este dia. O site não oferece horários nele.' : 'A barbearia não abre neste dia.'}</p>`}</div>
    ${fechadoManual ? '<button class="botao linha cheio" id="fechar-dia">Reabrir este dia</button>'
      : e ? '<button class="botao fantasma cheio" id="fechar-dia">Fechar o dia inteiro (folga ou feriado)</button>' : ''}`;

  document.querySelectorAll('#t-agenda [data-dia]').forEach((b) => b.onclick = () => { diaAgenda = b.dataset.dia; desenharAgenda(); });
  document.getElementById('sem-ant').onclick = () => { diaAgenda = somarDias(semanaDias[0], -7); desenharAgenda(); };
  document.getElementById('sem-prox').onclick = () => { diaAgenda = somarDias(semanaDias[0], 7); desenharAgenda(); };
  document.querySelectorAll('#t-agenda [data-livre]').forEach((b) => b.onclick = () => folhaLivre(dia, b.dataset.livre));
  document.querySelectorAll('#t-agenda [data-bloq]').forEach((b) => b.onclick = () => folhaBloqueio(S.bloqueios.find((x) => x.id === +b.dataset.bloq)));
  document.querySelectorAll('#t-agenda [data-ag]').forEach((b) => b.onclick = () => folhaCliente(S.agendamentos.find((a) => a.id === +b.dataset.ag)));
  const fd = document.getElementById('fechar-dia');
  if (fd) fd.onclick = () => (fechadoManual
    ? executar(fd, () => dados.reabrirDia(dia), { sucesso: 'Dia reaberto', log: `reabriu ${fmt(dia, { day: 'numeric', month: 'numeric' })}` })
    : folhaFecharDia(dia));
}
const diaAgendaSemana = (dias, dia) => Math.floor(dias.indexOf(dia) / 7);

function folhaLivre(dia, hora) {
  abrirFolha(`
    <h2>${diaExtenso(dia)}, ${hora}</h2>
    <div class="acoes">
      <button class="botao cheio" id="enc">Encaixar um cliente</button>
      <button class="botao fantasma cheio" id="blq">Bloquear este horário</button>
    </div>`, (f) => {
    f.querySelector('#enc').onclick = () => { fecharFolha(); folhaEncaixe(dia, hora); };
    f.querySelector('#blq').onclick = () => { fecharFolha(); folhaBloquear(dia, hora); };
  });
}

function folhaBloquear(dia, hora) {
  abrirFolha(`
    <h2>Bloquear ${diaExtenso(dia)} às ${hora}</h2>
    <p class="nota">O site para de oferecer este horário.</p>
    <p class="rotulo">Por quanto tempo</p>
    <div class="opcoes" id="dur">${[30, 60, 90, 120, 180].map((m, i) => `<button class="op" data-v="${m}" aria-pressed="${i === 1}">${m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + (m % 60 ? '30' : '')}</button>`).join('')}</div>
    <p class="rotulo">Motivo (só vocês veem)</p>
    <div class="opcoes" id="mot">${['Almoço', 'Compromisso', 'Pausa', 'Outro'].map((m, i) => `<button class="op" data-v="${m}" aria-pressed="${i === 0}">${m}</button>`).join('')}</div>
    <div class="acoes"><button class="botao cheio" id="ok">Bloquear</button><button class="botao fantasma cheio" data-fechar>Cancelar</button></div>`, (f) => {
    let min = 60, motivo = 'Almoço';
    escolha(f.querySelector('#dur'), (v) => min = +v);
    escolha(f.querySelector('#mot'), (v) => motivo = v);
    f.querySelector('#ok').onclick = async (ev) => {
      const e = expediente(dia);
      const ini = paraMin(hora);
      const conflito = S.agendamentos.some((a) => a.dia === dia && ATIVOS.includes(a.status) && paraMin(a.hora) < ini + min && paraMin(a.hora) + a.duracao_min > ini);
      if (conflito) return toast('Esse tempo passa por cima de um cliente. Escolha menos tempo.');
      if (ini + min > e.fecha) return toast('Esse tempo passa do horário de fechar.');
      if (await executar(ev.currentTarget, () => dados.criarBloqueio({ dia, hora, duracao_min: min, motivo }),
        { sucesso: 'Horário bloqueado', log: `bloqueou ${diaExtenso(dia)} às ${hora} (${motivo})` })) fecharFolha();
    };
  });
}

function folhaBloqueio(b) {
  abrirFolha(`
    <h2>${esc(b.motivo)}</h2>
    <p class="nota">${diaExtenso(b.dia)}, das ${b.hora} às ${paraHora(paraMin(b.hora) + b.duracao_min)}</p>
    <div class="acoes"><button class="botao linha cheio" id="lib">Liberar este horário</button><button class="botao fantasma cheio" data-fechar>Fechar</button></div>`, (f) => {
    f.querySelector('#lib').onclick = async (ev) => {
      if (await executar(ev.currentTarget, () => dados.removerBloqueio(b.id), { sucesso: 'Horário liberado', log: `liberou ${diaExtenso(b.dia)} às ${b.hora}` })) fecharFolha();
    };
  });
}

function folhaCliente(a) {
  abrirFolha(`
    <h2>${esc(a.nome)}</h2>
    <p class="nota">${esc(a.servico)} · ${a.duracao_min} min · ${real(precoDe(a))}<br>${diaExtenso(a.dia)} às ${a.hora} · marcou pelo ${esc(a.origem)}${a.telefone ? `<br>WhatsApp ${esc(a.telefone)}` : ''}${a.observacao ? `<br>"${esc(a.observacao)}"` : ''}</p>
    ${chip(a.status)}
    <div class="visitas" id="visitas">${a.telefone ? 'Buscando visitas anteriores…' : ''}</div>
    <div class="acoes">
      ${a.status === 'pendente' ? '<button class="botao cheio" data-x="confirmar">Confirmar</button><button class="botao fantasma cheio" data-x="recusar">Recusar</button>' : ''}
      ${a.status === 'confirmado' ? '<button class="botao fantasma cheio" data-x="remarcar">Remarcar</button><button class="botao perigo cheio" data-x="cancelar">Cancelar horário</button>' : ''}
      ${a.telefone && !DEMO ? `<a class="botao wpp cheio" href="${esc(linkWhatsApp(a.telefone, `Olá, ${primeiroNome(a.nome)}!`) || '#')}" target="_blank" rel="noopener noreferrer">Conversar no WhatsApp</a>` : ''}
      <button class="botao fantasma cheio" data-fechar>Fechar</button>
    </div>`, (f) => {
    f.querySelectorAll('[data-x]').forEach((b) => b.onclick = async () => {
      const x = b.dataset.x;
      if (x === 'cancelar') {
        const ok = await executar(b, () => dados.atualizarAgendamento(a.id, { status: 'cancelado' }), { log: `cancelou o horário de ${a.nome} (${diaExtenso(a.dia)} ${a.hora})` });
        if (ok) folhaMensagem('Horário cancelado', a, `Olá, ${primeiroNome(a.nome)}! Precisei cancelar seu horário de ${diaExtenso(a.dia)} às ${horaFalada(a.hora)}. Me desculpe. Quer marcar outro dia?`);
        return;
      }
      fecharFolha();
      acao(x, a.id, null);
    });
    if (a.telefone) dados.visitas(a.telefone).then((v) => {
      const el = f.querySelector('#visitas');
      if (!el || !el.isConnected) return;
      const feitas = v.filter((x) => x.status === 'chegou');
      const faltas = v.length - feitas.length;
      el.innerHTML = feitas.length
        ? `<span><b>${feitas.length} visita${feitas.length > 1 ? 's' : ''}</b>${faltas ? ` · ${faltas} falta${faltas > 1 ? 's' : ''}` : ''}</span><span>Última: ${fmt(feitas[0].dia, { day: 'numeric', month: 'numeric', year: '2-digit' })}, ${esc(feitas[0].servico)}</span>`
        : `<span>Primeira visita${faltas ? ` · ${faltas} falta${faltas > 1 ? 's' : ''} antes` : ''}</span>`;
    }).catch(() => { const el = f.querySelector('#visitas'); if (el) el.textContent = ''; });
  });
}

function folhaFecharDia(dia) {
  const afetados = S.agendamentos.filter((a) => a.dia === dia && ['pendente', 'confirmado'].includes(a.status));
  abrirFolha(`
    <h2>Fechar ${diaExtenso(dia)}?</h2>
    <p class="nota">O site para de oferecer horários neste dia.${afetados.length ? ` Há ${afetados.length} cliente${afetados.length > 1 ? 's' : ''} marcado${afetados.length > 1 ? 's' : ''}: ${afetados.map((a) => esc(primeiroNome(a.nome))).join(', ')}. Eles continuam na agenda e você avisa cada um pelo WhatsApp.` : ''}</p>
    <label class="r">Motivo (opcional)<input class="campo" id="motivo-dia" maxlength="80" placeholder="Ex.: feriado"></label>
    <div class="acoes"><button class="botao perigo cheio" id="ok">Fechar o dia</button><button class="botao fantasma cheio" data-fechar>Cancelar</button></div>`, (f) => {
    f.querySelector('#ok').onclick = async (ev) => {
      const motivo = f.querySelector('#motivo-dia').value.trim() || null;
      if (await executar(ev.currentTarget, () => dados.fecharDia(dia, motivo), { sucesso: 'Dia fechado', log: `fechou ${fmt(dia, { day: 'numeric', month: 'numeric' })}${motivo ? ` (${motivo})` : ''}` })) fecharFolha();
    };
  });
}

function folhaEncaixe(dia, horaFixa) {
  const agendaveis = S.servicos.filter((s) => s.ativo);
  abrirFolha(`
    <h2>Encaixar cliente</h2>
    <p class="nota">Para quem chegou na porta ou marcou pelo WhatsApp. Assim a agenda fica completa e o site não oferece esse horário para outra pessoa.</p>
    <label class="r">Nome<input class="campo" id="enc-nome" autocomplete="off" maxlength="80" placeholder="Ex.: Carlos"></label>
    <label class="r">WhatsApp (opcional)<input class="campo" id="enc-tel" type="tel" inputmode="tel" maxlength="20" placeholder="(51) 90000-0000"></label>
    <label class="r">Serviço<select class="campo" id="enc-serv">${agendaveis.map((s) => `<option value="${esc(s.nome)}">${esc(s.nome)} · ${s.duracao_min} min</option>`).join('')}</select></label>
    <p class="rotulo">Como marcou</p>
    <div class="opcoes" id="enc-orig">${['balcão', 'WhatsApp', 'telefone'].map((o, i) => `<button class="op" data-v="${o}" aria-pressed="${i === 0}">${o[0].toUpperCase() + o.slice(1)}</button>`).join('')}</div>
    <p class="rotulo">Horário · ${diaExtenso(dia)}</p>
    <div class="opcoes" id="enc-hora"></div>
    <div class="acoes"><button class="botao cheio" id="ok">Colocar na agenda</button><button class="botao fantasma cheio" data-fechar>Cancelar</button></div>`, (f) => {
    let origem = 'balcão', hora = horaFixa || '';
    escolha(f.querySelector('#enc-orig'), (v) => origem = v);
    const servSel = f.querySelector('#enc-serv');
    const horas = () => {
      const l = livres(dia, servicoDe(servSel.value).duracao_min);
      if (!l.includes(hora)) hora = l[0] || '';
      const box = f.querySelector('#enc-hora');
      box.innerHTML = l.length ? l.slice(0, 24).map((h) => `<button class="op" data-v="${h}" aria-pressed="${h === hora}">${h}</button>`).join('') : '<p class="nota">Sem horário livre para este serviço neste dia.</p>';
      escolha(box, (v) => hora = v);
    };
    servSel.onchange = horas;
    horas();
    f.querySelector('#ok').onclick = async (ev) => {
      const nome = f.querySelector('#enc-nome').value.trim();
      if (!nome) { f.querySelector('#enc-nome').focus(); return toast('Escreva o nome do cliente'); }
      if (!hora) return toast('Escolha um horário');
      const s = servicoDe(servSel.value);
      const obj = { nome, telefone: f.querySelector('#enc-tel').value.trim(), servico: s.nome, preco: s.preco, duracao_min: s.duracao_min, dia, hora, status: 'confirmado', origem };
      if (await executar(ev.currentTarget, () => dados.criarAgendamento(obj), { sucesso: `${primeiroNome(nome)} encaixado às ${hora}`, log: `encaixou ${nome} ${diaExtenso(dia)} às ${hora} (${s.nome})` })) fecharFolha();
    };
  });
}

function folhaRemarcar(a) {
  const dias = Array.from({ length: 21 }, (_, i) => somarDias(hojeSP(), i)).filter((d) => expediente(d)).slice(0, 10);
  abrirFolha(`
    <h2>Remarcar ${esc(primeiroNome(a.nome))}</h2>
    <p class="nota">Agora: ${esc(a.servico)}, ${diaExtenso(a.dia)} às ${a.hora}</p>
    <p class="rotulo">Novo dia</p>
    <div class="opcoes" id="rm-dia">${dias.map((d, i) => `<button class="op" data-v="${d}" aria-pressed="${i === 0}">${d === hojeSP() ? 'hoje' : SEMANA[semanaDe(d)]}<small>${fmt(d, { day: 'numeric', month: 'numeric' })}</small></button>`).join('')}</div>
    <p class="rotulo">Novo horário</p>
    <div class="opcoes" id="rm-hora"></div>
    <div class="acoes"><button class="botao cheio" id="ok">Remarcar e preparar mensagem</button><button class="botao fantasma cheio" data-fechar>Cancelar</button></div>`, (f) => {
    let dia = dias[0], hora = '';
    const horas = () => {
      const l = livres(dia, a.duracao_min, a.id).filter((h) => !(dia === a.dia && h === a.hora));
      hora = l[0] || '';
      const box = f.querySelector('#rm-hora');
      box.innerHTML = l.length ? l.slice(0, 24).map((h, i) => `<button class="op" data-v="${h}" aria-pressed="${i === 0}">${h}</button>`).join('') : '<p class="nota">Sem horário livre neste dia.</p>';
      escolha(box, (v) => hora = v);
    };
    escolha(f.querySelector('#rm-dia'), (v) => { dia = v; horas(); });
    horas();
    f.querySelector('#ok').onclick = async (ev) => {
      if (!hora) return toast('Escolha um horário');
      const antes = `${diaExtenso(a.dia)} às ${a.hora}`;
      const ok = await executar(ev.currentTarget, () => dados.atualizarAgendamento(a.id, { dia, hora, status: a.status === 'pendente' ? 'confirmado' : a.status }),
        { log: `remarcou ${a.nome} de ${antes} para ${diaExtenso(dia)} às ${hora}` });
      if (ok) folhaMensagem('Horário remarcado', { ...a, dia, hora }, `Olá, ${primeiroNome(a.nome)}! Seu horário foi remarcado para ${diaExtenso(dia)} às ${horaFalada(hora)}. Qualquer coisa, me chama aqui.`);
    };
  });
}

/* mensagem pronta para o WhatsApp */
function folhaMensagem(titulo, a, texto) {
  const link = DEMO ? null : linkWhatsApp(a.telefone, texto);
  abrirFolha(`
    <h2>${esc(titulo)}</h2>
    <div class="balao-cab"><span>Para ${esc(a.nome)}</span><span>${esc(a.telefone || 'sem WhatsApp')}</span></div>
    <div class="balao" id="msg">${esc(texto)}</div>
    <p class="nota">${link ? 'Toque em "Abrir WhatsApp": a conversa abre com a mensagem pronta. Confira e toque em enviar.'
      : DEMO ? 'Com o banco ligado, aqui aparece o botão que abre o WhatsApp do cliente com esta mensagem. Na demonstração, nada é enviado.'
        : 'Este cliente não tem WhatsApp cadastrado. Copie a mensagem se quiser mandar por outro meio.'}</p>
    <div class="acoes">
      ${link ? `<a class="botao wpp cheio" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>` : ''}
      <button class="botao ${link ? 'fantasma' : ''} cheio" id="copiar">Copiar mensagem</button>
      <button class="botao fantasma cheio" data-fechar>Pronto</button>
    </div>`, (f) => {
    f.querySelector('#copiar').onclick = () => {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texto).then(() => toast('Mensagem copiada'), () => selecionar(f.querySelector('#msg')));
      else selecionar(f.querySelector('#msg'));
    };
  });
}
function selecionar(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
  toast('Texto selecionado. Use Copiar do celular.');
}

/* ---------- Ajustes ---------- */
function desenharAjustes() {
  const nomeDe = (email) => S.admins.find((x) => x.email === email)?.nome || (email === 'sistema' ? 'Site' : email);
  const quando = (iso) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const avisoNotif = !('Notification' in window) ? '' : Notification.permission === 'granted'
    ? '<p class="nota">Este aparelho avisa quando chega pedido, enquanto o painel estiver aberto.</p>'
    : '<button class="botao fantasma cheio" id="notif">Avisar neste aparelho quando chegar pedido</button>';

  document.getElementById('t-ajustes').innerHTML = `
    <div class="cabeca"><h1>Ajustes</h1><p>O que você muda aqui aparece no site na hora.</p></div>

    <div class="bloco">
      <div class="linha-aj"><div><b>Receber pedidos pelo site</b><small>Desligue nas férias. O site avisa o cliente para chamar no WhatsApp.</small></div>
        <label class="interruptor"><input type="checkbox" id="receb" ${S.config.recebendo ? 'checked' : ''} aria-label="Receber pedidos pelo site"><span></span></label></div>
      <div class="dois">
        <label class="r">Marcar com até<select class="campo" id="antecedencia">${[7, 14, 30, 60, 90].map((d) => `<option value="${d}" ${d === S.config.antecedencia_dias ? 'selected' : ''}>${d} dias</option>`).join('')}</select></label>
        <label class="r">Aviso mínimo<select class="campo" id="aviso-min">${[[0, 'nenhum'], [30, '30 min'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [720, '12 horas']].map(([v, t]) => `<option value="${v}" ${v === S.config.aviso_minimo_min ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      ${avisoNotif}
    </div>

    <div class="bloco">
      <h2>Serviços e preços</h2>
      <p class="nota">Toque num serviço para mudar o preço, a duração ou esconder do site.</p>
      ${CATEGORIAS.map((c) => {
        const itens = S.servicos.filter((s) => s.categoria === c);
        if (!itens.length) return '';
        return `<p class="cat-titulo">${esc(c)}</p>` + itens.map((s) => `
          <button class="serv-linha ${s.ativo ? '' : 'oculto'}" data-serv="${s.id}">
            <span><b>${s.destaque ? '★ ' : ''}${esc(s.nome)}</b><small>${s.duracao_min} min${s.detalhe && c !== 'Combo' ? ` · ${esc(s.detalhe)}` : ''}${s.ativo ? (s.agendavel ? '' : ' · não agenda pelo site') : ' · escondido do site'}</small></span>
            <span class="preco">${real(s.preco)}</span>
          </button>`).join('');
      }).join('')}
      <button class="botao linha cheio" id="novo-serv">+ Novo serviço</button>
    </div>

    <div class="bloco">
      <h2>Horário da barbearia</h2>
      ${[1, 2, 3, 4, 5, 6, 0].map((w) => { const h = S.horario.find((x) => x.dia_semana === w); return `<div class="hor ${h.aberto ? '' : 'fechado'}" data-w="${w}">
        <span>${SEMANA_LONGA[w]}</span>
        <input type="time" class="h-abre" value="${h.abre}" step="900" aria-label="${SEMANA_LONGA[w]}: abre às">
        <input type="time" class="h-fecha" value="${h.fecha}" step="900" aria-label="${SEMANA_LONGA[w]}: fecha às">
        <label class="interruptor"><input type="checkbox" class="h-aberto" ${h.aberto ? 'checked' : ''} aria-label="Abre na ${SEMANA_LONGA[w]}"><span></span></label>
      </div>`; }).join('')}
      <button class="botao cheio" id="salvar-hor">Salvar horário</button>
    </div>

    <div class="bloco">
      <h2>Quem tem acesso</h2>
      ${S.admins.map((a) => `<div class="pessoa"><span class="av">${esc(a.nome.slice(0, 2).toUpperCase())}</span><div><b>${esc(a.nome)}</b><small>${a.papel === 'dono' ? 'Dono' : 'Suporte'} · ${esc(a.email)}</small></div></div>`).join('')}
      <p class="nota">Só estas contas Google entram. A lista só muda direto no Supabase (veja docs/PAINEL.md), nunca pelo painel.</p>
    </div>

    <div class="bloco log">
      <h2>Histórico</h2>
      <p class="nota">Tudo o que muda fica registrado com o nome de quem mudou.</p>
      <ul>${S.historico.slice(0, 25).map((l) => `<li><time>${quando(l.quando)}</time><span><b>${esc(nomeDe(l.quem))}</b> ${esc(l.texto)}</span></li>`).join('') || '<li>Nada ainda.</li>'}</ul>
    </div>

    ${DEMO ? `<div class="bloco"><h2>Demonstração</h2>
      <button class="botao linha cheio" id="simular">Simular pedido chegando pelo site</button>
      <button class="botao fantasma cheio" id="reiniciar">Recomeçar a demonstração</button></div>` : ''}`;

  const t = document.getElementById('t-ajustes');
  t.querySelector('#receb').onchange = (e) => executar(null, () => dados.salvarConfig({ recebendo: e.target.checked }),
    { sucesso: e.target.checked ? 'Pedidos pelo site ligados' : 'Pedidos pelo site pausados', log: e.target.checked ? 'ligou os pedidos pelo site' : 'pausou os pedidos pelo site' });
  t.querySelector('#antecedencia').onchange = (e) => executar(null, () => dados.salvarConfig({ antecedencia_dias: +e.target.value }),
    { sucesso: 'Salvo', log: `mudou a antecedência para ${e.target.value} dias` });
  t.querySelector('#aviso-min').onchange = (e) => executar(null, () => dados.salvarConfig({ aviso_minimo_min: +e.target.value }),
    { sucesso: 'Salvo', log: `mudou o aviso mínimo para ${e.target.selectedOptions[0].textContent}` });
  t.querySelector('#notif')?.addEventListener('click', async () => {
    const r = await Notification.requestPermission();
    toast(r === 'granted' ? 'Pronto: este aparelho vai avisar' : 'O aviso não foi permitido neste aparelho');
    desenhar();
  });
  t.querySelectorAll('[data-serv]').forEach((b) => b.onclick = () => folhaServico(S.servicos.find((s) => s.id === +b.dataset.serv)));
  t.querySelector('#novo-serv').onclick = () => folhaServico(null);
  t.querySelectorAll('.h-aberto').forEach((c) => c.onchange = () => c.closest('.hor').classList.toggle('fechado', !c.checked));
  t.querySelector('#salvar-hor').onclick = async (ev) => {
    const linhas = [...t.querySelectorAll('.hor')].map((l) => ({ w: +l.dataset.w, aberto: l.querySelector('.h-aberto').checked, abre: l.querySelector('.h-abre').value, fecha: l.querySelector('.h-fecha').value }));
    const ruim = linhas.find((l) => !l.abre || !l.fecha || l.fecha <= l.abre);
    if (ruim) return toast(`${SEMANA_LONGA[ruim.w]}: o horário de fechar precisa ser depois do de abrir.`);
    const mudou = linhas.filter((l) => { const h = S.horario.find((x) => x.dia_semana === l.w); return h.aberto !== l.aberto || h.abre !== l.abre || h.fecha !== l.fecha; });
    if (!mudou.length) return toast('Nada mudou');
    await executar(ev.currentTarget, async () => { for (const l of mudou) await dados.salvarHorario(l.w, { aberto: l.aberto, abre: l.abre, fecha: l.fecha }); },
      { sucesso: 'Horário salvo. O site já mostra o novo horário.', log: `mudou o horário: ${mudou.map((l) => `${SEMANA_LONGA[l.w].toLowerCase()} ${l.aberto ? `${l.abre}–${l.fecha}` : 'fechado'}`).join(', ')}` });
  };
  t.querySelector('#simular')?.addEventListener('click', () => { if (!dados.simularPedido()) toast('Sem horário livre amanhã para simular'); });
  t.querySelector('#reiniciar')?.addEventListener('click', () => location.reload());
}

function folhaServico(s) {
  const novo = !s;
  s = s || { nome: '', detalhe: '', categoria: 'Cortes', preco: 0, duracao_min: 45, destaque: false, ativo: true, agendavel: true };
  abrirFolha(`
    <h2>${novo ? 'Novo serviço' : esc(s.nome)}</h2>
    <label class="r">Nome<input class="campo" id="sv-nome" maxlength="60" value="${esc(s.nome)}"></label>
    <label class="r">Detalhe (opcional, aparece pequeno no site)<input class="campo" id="sv-det" maxlength="200" value="${esc(s.detalhe || '')}" placeholder="Ex.: cabelo até 5 cm"></label>
    <div class="dois">
      <label class="r">Preço (R$)<input class="campo" id="sv-preco" type="number" inputmode="decimal" min="0" step="1" value="${s.preco ?? ''}" ${s.preco == null ? 'disabled' : ''}></label>
      <label class="r">Duração<select class="campo" id="sv-dur">${[...new Set([...DURACOES, s.duracao_min])].sort((a, b) => a - b).map((m) => `<option value="${m}" ${m === s.duracao_min ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
    </div>
    <label class="r">Grupo na tabela de preços<select class="campo" id="sv-cat">${CATEGORIAS.map((c) => `<option ${c === s.categoria ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <div class="linha-aj"><div><b>Preço a combinar</b><small>O site mostra "a combinar" no lugar do valor.</small></div><label class="interruptor"><input type="checkbox" id="sv-comb" ${s.preco == null ? 'checked' : ''}><span></span></label></div>
    <div class="linha-aj"><div><b>Aparece no site</b><small>Desligue para esconder sem apagar.</small></div><label class="interruptor"><input type="checkbox" id="sv-ativo" ${s.ativo ? 'checked' : ''}><span></span></label></div>
    <div class="linha-aj"><div><b>Pode agendar pelo site</b><small>Aparece na lista do formulário.</small></div><label class="interruptor"><input type="checkbox" id="sv-agend" ${s.agendavel ? 'checked' : ''}><span></span></label></div>
    <div class="linha-aj"><div><b>Destaque ★</b><small>Marca com estrela na tabela.</small></div><label class="interruptor"><input type="checkbox" id="sv-dest" ${s.destaque ? 'checked' : ''}><span></span></label></div>
    <div class="acoes"><button class="botao cheio" id="ok">Salvar</button><button class="botao fantasma cheio" data-fechar>Cancelar</button></div>`, (f) => {
    const comb = f.querySelector('#sv-comb');
    const preco = f.querySelector('#sv-preco');
    comb.onchange = () => { preco.disabled = comb.checked; if (!comb.checked && preco.value === '') preco.value = '0'; };
    f.querySelector('#ok').onclick = async (ev) => {
      const nome = f.querySelector('#sv-nome').value.trim();
      if (!nome) { f.querySelector('#sv-nome').focus(); return toast('Escreva o nome do serviço'); }
      const valor = comb.checked ? null : Math.round(Number(preco.value.replace(',', '.')) * 100) / 100;
      if (valor != null && !(valor >= 0)) return toast('Preço inválido');
      const campos = {
        nome, detalhe: f.querySelector('#sv-det').value.trim() || null, categoria: f.querySelector('#sv-cat').value,
        preco: valor, duracao_min: +f.querySelector('#sv-dur').value,
        ativo: f.querySelector('#sv-ativo').checked, agendavel: f.querySelector('#sv-agend').checked, destaque: f.querySelector('#sv-dest').checked,
      };
      if (novo) campos.ordem = Math.max(0, ...S.servicos.map((x) => x.ordem)) + 10;
      const log = novo ? `criou o serviço ${nome} (${real(valor)})`
        : s.preco !== valor ? `mudou o preço de ${s.nome} de ${real(s.preco)} para ${real(valor)}` : `editou o serviço ${nome}`;
      if (await executar(ev.currentTarget, () => dados.salvarServico(novo ? campos : { id: s.id, ...campos }),
        { sucesso: 'Salvo. O site já mostra o novo valor.', log })) fecharFolha();
    };
  });
}

/* ===================== peças ===================== */
let veu = null;
let focoAntes = null;
function abrirFolha(html, montar) {
  fecharFolha();
  focoAntes = document.activeElement;
  veu = document.createElement('div');
  veu.className = 'veu';
  veu.innerHTML = `<div class="folha" role="dialog" aria-modal="true">${html}</div>`;
  veu.addEventListener('click', (e) => { if (e.target === veu || e.target.closest('[data-fechar]')) fecharFolha(); });
  document.body.appendChild(veu);
  const f = veu.querySelector('.folha');
  montar?.(f);
  (f.querySelector('input:not([disabled]), .botao') || f).focus({ preventScroll: true });
}
function fecharFolha() {
  if (!veu) return;
  veu.remove();
  veu = null;
  focoAntes?.isConnected && focoAntes.focus?.({ preventScroll: true });
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharFolha(); });

function escolha(box, aoEscolher) {
  box.querySelectorAll('.op').forEach((b) => b.onclick = () => {
    box.querySelectorAll('.op').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    aoEscolher(b.dataset.v);
  });
}

let tempoToast;
function toast(txt) {
  document.querySelector('.aviso-toast')?.remove();
  const t = document.createElement('div');
  t.className = 'aviso-toast';
  t.setAttribute('role', 'status');
  t.textContent = txt;
  document.body.appendChild(t);
  clearTimeout(tempoToast);
  tempoToast = setTimeout(() => t.remove(), 3200);
}

if (!DEMO) dados.aoMudarSessao((evento) => { if (evento === 'SIGNED_OUT' && eu) { eu = null; telaLogin(); } });
iniciar();
