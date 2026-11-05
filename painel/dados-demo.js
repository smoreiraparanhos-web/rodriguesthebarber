// Modo demonstração: mesma interface de dados.js, mas tudo fica na memória do navegador.
// Usado enquanto o banco não está configurado (js/config.js vazio) ou ao abrir o painel com ?demo.
// Nenhum dado sai do aparelho e nada é gravado.

import { hojeSP, somarDias, semanaDe, paraMin, paraHora } from './tempo.js';

const ATIVOS = ['pendente', 'confirmado', 'chegou'];
const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const copia = (x) => JSON.parse(JSON.stringify(x));

export function criarDemo() {
  const hoje = hojeSP();
  let seq = 100;
  let usuario = null;
  const ouvintes = [];

  const servicos = [
    ['Corte degradê', 'na 0 ou na 1', 'Cortes', 35, 45, false], ['Low, mid ou high fade', null, 'Cortes', 40, 45, false],
    ['Skin fade navalhado', 'o mais pedido', 'Cortes', 40, 45, true], ['Corte do jaca', null, 'Cortes', 45, 45, false],
    ['Executivo ou pente corrido', null, 'Cortes', 45, 45, false], ['Corte infantil', null, 'Cortes', 35, 45, false],
    ['Contorno desenhado', 'pezinho', 'Barba e alinhamento', 25, 15, false], ['Barba aparada', null, 'Barba e alinhamento', 35, 30, false],
    ['Barba feita na navalha', 'tradicional', 'Barba e alinhamento', 25, 30, true], ['Pigmentação no cabelo', null, 'Pigmentação', 35, 60, false],
    ['Pigmentação na barba', null, 'Pigmentação', 20, 30, false], ['Sobrancelha', null, 'Pigmentação', 15, 15, false],
    ['Luzes curtas', 'cabelo até 5 cm', 'Luzes e cor', 50, 120, false], ['Luzes médias', 'cabelo até 10 cm', 'Luzes e cor', 75, 120, false],
    ['Platinado', null, 'Luzes e cor', 180, 180, false], ['Freestyle e desenho', null, 'Luzes e cor', null, 60, false],
    ['Ritual Rodrigues', 'Corte em qualquer estilo, pigmentação completa no cabelo, barba feita e sobrancelha. O alinhamento completo, de uma vez só.', 'Combo', 100, 90, false],
  ].map(([nome, detalhe, categoria, preco, duracao_min, destaque], i) => ({
    id: i + 1, nome, detalhe, categoria, preco, duracao_min, destaque, agendavel: true, ativo: true, ordem: (i + 1) * 10,
  }));

  const db = {
    config: { id: 1, recebendo: true, antecedencia_dias: 60, aviso_minimo_min: 60, passo_min: 30, max_pendentes_por_telefone: 3 },
    servicos,
    horario: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dia_semana: d, aberto: true, abre: '09:00', fecha: d === 0 ? '12:00' : '20:00' })),
    fechados: [],
    bloqueios: [],
    agendamentos: [],
    admins: [
      { email: 'tiago@exemplo.com', nome: 'Tiago', papel: 'dono' },
      { email: 'suporte@exemplo.com', nome: 'Suporte', papel: 'suporte' },
    ],
    historico: [],
  };

  const srv = (nome) => db.servicos.find((s) => s.nome === nome);
  const expediente = (dia) => {
    if (db.fechados.some((f) => f.dia === dia)) return null;
    const h = db.horario[semanaDe(dia)];
    return h.aberto ? { abre: paraMin(h.abre), fecha: paraMin(h.fecha) } : null;
  };
  const conflita = (a, ignorar) => db.agendamentos.some((b) => b.id !== ignorar && b.dia === a.dia && ATIVOS.includes(b.status)
    && paraMin(b.hora) < paraMin(a.hora) + a.duracao_min && paraMin(b.hora) + b.duracao_min > paraMin(a.hora));

  const add = (n, hora, nome, servico, status, origem, telefone, observacao = '', minutosAtras = 30) => {
    const dia = somarDias(hoje, n);
    const e = expediente(dia);
    const s = srv(servico);
    if (!e || paraMin(hora) < e.abre || paraMin(hora) + s.duracao_min > e.fecha) return;
    const a = { id: ++seq, nome, telefone, servico, preco: s.preco, duracao_min: s.duracao_min, dia, hora, status, origem, observacao, criado: Date.now() - minutosAtras * 60000 };
    if (!conflita(a)) db.agendamentos.push(a);
  };
  if (semanaDe(hoje) !== 0) db.bloqueios.push({ id: ++seq, dia: hoje, hora: '12:00', duracao_min: 60, motivo: 'Almoço' });
  add(0, '09:00', 'Rafael Souza', 'Low, mid ou high fade', 'confirmado', 'site', '(51) 99812-4312');
  add(0, '10:00', 'Marcos Lima', 'Barba feita na navalha', 'confirmado', 'WhatsApp', '(51) 98455-1290');
  add(0, '11:00', 'Diego Martins', 'Skin fade navalhado', 'confirmado', 'site', '(51) 99107-6634');
  add(0, '14:00', 'João Pedro', 'Corte degradê', 'confirmado', 'site', '(51) 99230-8871');
  add(0, '15:30', 'Bruno Alves', 'Ritual Rodrigues', 'confirmado', 'balcão', '(51) 98761-0045');
  add(0, '18:30', 'Felipe Costa', 'Corte degradê', 'pendente', 'site', '(51) 99654-2208', '', 12);
  add(1, '09:30', 'Gustavo Reis', 'Barba aparada', 'confirmado', 'WhatsApp', '(51) 99021-7765');
  add(1, '10:30', 'Lucas Ferreira', 'Skin fade navalhado', 'pendente', 'site', '(51) 98340-1123', 'Primeira vez, quero ver o visagismo.', 47);
  add(1, '15:00', 'Eduardo Nunes', 'Platinado', 'confirmado', 'site', '(51) 99877-5512');
  add(2, '11:00', 'Paulo Henrique', 'Corte infantil', 'confirmado', 'balcão', '(51) 98112-9934', 'Filho de 7 anos.');
  add(2, '16:00', 'André Moura', 'Ritual Rodrigues', 'pendente', 'site', '(51) 99403-6617', '', 180);
  add(3, '17:00', 'Vinícius Prado', 'Corte do jaca', 'confirmado', 'site', '(51) 99550-3381');
  add(-7, '10:00', 'Rafael Souza', 'Low, mid ou high fade', 'chegou', 'site', '(51) 99812-4312');
  add(-21, '10:00', 'Rafael Souza', 'Low, mid ou high fade', 'chegou', 'site', '(51) 99812-4312');
  add(-14, '16:00', 'João Pedro', 'Corte degradê', 'faltou', 'site', '(51) 99230-8871');

  const log = (texto) => db.historico.unshift({ quando: new Date().toISOString(), quem: usuario?.email || 'sistema', texto });
  log('Demonstração iniciada com dados de exemplo');
  const avisar = (tipo, a) => ouvintes.forEach((cb) => cb(tipo, a));
  const erro = (m) => { throw new Error(m); };

  return {
    demo: true,
    async sessao() { return usuario ? { user: { email: usuario.email } } : null; },
    async papel() { return usuario && usuario.papel ? { ...usuario } : null; },
    // na demonstração, "entrar" recebe a conta escolhida na tela
    async entrar(conta) {
      usuario = conta === 'outra' ? { email: 'curioso@gmail.com' } : { ...db.admins.find((a) => a.papel === conta) };
    },
    async sair() { usuario = null; },
    aoMudarSessao() {},

    async carregar(desde) {
      await espera();
      return copia({
        ...db,
        fechados: db.fechados.filter((f) => f.dia >= desde),
        bloqueios: db.bloqueios.filter((b) => b.dia >= desde),
        agendamentos: db.agendamentos.filter((a) => a.dia >= desde || a.status === 'pendente'),
        historico: db.historico.slice(0, 40),
      });
    },
    ouvir(cb) { ouvintes.push(cb); },

    async atualizarAgendamento(id, campos) {
      await espera();
      const a = db.agendamentos.find((x) => x.id === id);
      const novo = { ...a, ...campos };
      if (ATIVOS.includes(novo.status) && conflita(novo, id)) erro('Esse horário já está ocupado por outro cliente.');
      Object.assign(a, campos);
      avisar('UPDATE', a);
    },
    async criarAgendamento(obj) {
      await espera();
      const a = { id: ++seq, telefone: '', observacao: '', criado: Date.now(), ...obj };
      if (conflita(a)) erro('Esse horário já está ocupado por outro cliente.');
      db.agendamentos.push(a);
      avisar('INSERT', a);
    },
    async criarBloqueio(obj) { await espera(); db.bloqueios.push({ id: ++seq, ...obj }); },
    async removerBloqueio(id) { await espera(); db.bloqueios = db.bloqueios.filter((b) => b.id !== id); },
    async fecharDia(dia, motivo) { await espera(); db.fechados.push({ dia, motivo }); },
    async reabrirDia(dia) { await espera(); db.fechados = db.fechados.filter((f) => f.dia !== dia); },
    async salvarServico({ id, ...campos }) {
      await espera();
      if (db.servicos.some((s) => s.nome.toLowerCase() === campos.nome?.toLowerCase() && s.id !== id)) erro('Já existe um item com esse nome.');
      if (id) Object.assign(db.servicos.find((s) => s.id === id), campos);
      else db.servicos.push({ id: ++seq, ordem: 999, agendavel: true, ativo: true, destaque: false, ...campos });
    },
    async salvarHorario(dia, campos) { await espera(); Object.assign(db.horario[dia], campos); },
    async salvarConfig(campos) { await espera(); Object.assign(db.config, campos); },
    async registrar(texto) { log(texto); },
    async visitas(telefone) {
      return db.agendamentos.filter((a) => a.telefone === telefone && ['chegou', 'faltou'].includes(a.status))
        .sort((a, b) => b.dia.localeCompare(a.dia)).map(({ dia, servico, status }) => ({ dia, servico, status }));
    },

    // só na demonstração: simula um pedido novo chegando pelo site
    simularPedido() {
      const dia = somarDias(hoje, 1);
      const e = expediente(dia);
      if (!e) return false;
      for (let m = e.abre; m + 45 <= e.fecha; m += 30) {
        const a = { id: ++seq, nome: 'Carlos Mendes', telefone: '(51) 99345-7781', servico: 'Corte degradê', preco: 35, duracao_min: 45,
          dia, hora: paraHora(m), status: 'pendente', origem: 'site', observacao: '', criado: Date.now() };
        if (!conflita(a) && !db.bloqueios.some((b) => b.dia === dia && paraMin(b.hora) < m + 45 && paraMin(b.hora) + b.duracao_min > m)) {
          db.agendamentos.push(a);
          avisar('INSERT', a);
          return true;
        }
      }
      return false;
    },
  };
}
