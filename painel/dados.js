// Ligação do painel com o banco (Supabase).
// Todas as regras de quem pode ler e mudar ficam no banco (supabase/schema.sql);
// este arquivo só pede e envia os dados.

const traduzir = (erro) => {
  const msg = erro?.message || String(erro);
  if (erro?.code === '23P01' || msg.includes('sem_conflito')) return new Error('Esse horário já está ocupado por outro cliente.');
  if (erro?.code === '23505') return new Error('Já existe um item com esse nome.');
  if (erro?.code === '23514') return new Error('Algum campo ficou inválido. Confira e tente de novo.');
  if (erro?.code === '42501' || erro?.code === 'PGRST301') return new Error('Sem permissão. Entre de novo no painel.');
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return new Error('Sem internet. Confira a conexão e tente de novo.');
  return new Error(msg);
};
const ok = ({ data, error }) => { if (error) throw traduzir(error); return data; };
const hora = (t) => (t || '').slice(0, 5);

export function criarDados({ url, chave }) {
  const sb = window.supabase.createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });

  return {
    demo: false,

    async sessao() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    async papel() {
      return ok(await sb.rpc('meu_papel'));
    },
    entrar() {
      return sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
      });
    },
    sair() { return sb.auth.signOut(); },
    aoMudarSessao(cb) { sb.auth.onAuthStateChange((evento, sessao) => cb(evento, sessao)); },

    async carregar(desde) {
      const [config, servicos, horario, fechados, bloqueios, agendamentos, admins, historico] = await Promise.all([
        sb.from('config').select('*').eq('id', 1).single().then(ok),
        sb.from('servicos').select('*').order('ordem').order('id').then(ok),
        sb.from('horario').select('*').order('dia_semana').then(ok),
        sb.from('dias_fechados').select('*').gte('dia', desde).then(ok),
        sb.from('bloqueios').select('id,dia,hora,duracao_min,motivo').gte('dia', desde).then(ok),
        sb.from('agendamentos')
          .select('id,nome,telefone,servico,preco,duracao_min,dia,hora,status,origem,observacao,criado_em')
          .or(`dia.gte.${desde},status.eq.pendente`).order('dia').order('hora').limit(3000).then(ok),
        sb.from('admins').select('email,nome,papel').then(ok),
        sb.from('historico').select('quando,quem,texto').order('quando', { ascending: false }).limit(40).then(ok),
      ]);
      return {
        config,
        servicos,
        horario: horario.map((h) => ({ ...h, abre: hora(h.abre), fecha: hora(h.fecha) })),
        fechados,
        bloqueios: bloqueios.map((b) => ({ ...b, hora: hora(b.hora) })),
        agendamentos: agendamentos.map((a) => ({ ...a, hora: hora(a.hora), criado: Date.parse(a.criado_em) })),
        admins,
        historico,
      };
    },

    // avisa quando um agendamento muda (por exemplo, um pedido novo do site)
    ouvir(cb) {
      sb.channel('agendamentos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, (p) => cb(p.eventType, p.new))
        .subscribe();
    },

    atualizarAgendamento: (id, campos) => sb.from('agendamentos').update(campos).eq('id', id).select('id').then(ok),
    criarAgendamento: (obj) => sb.from('agendamentos').insert(obj).then(ok),
    criarBloqueio: (obj) => sb.from('bloqueios').insert(obj).then(ok),
    removerBloqueio: (id) => sb.from('bloqueios').delete().eq('id', id).then(ok),
    fecharDia: (dia, motivo) => sb.from('dias_fechados').insert({ dia, motivo }).then(ok),
    reabrirDia: (dia) => sb.from('dias_fechados').delete().eq('dia', dia).then(ok),
    salvarServico: ({ id, ...campos }) => (id
      ? sb.from('servicos').update(campos).eq('id', id)
      : sb.from('servicos').insert(campos)).then(ok),
    salvarHorario: (dia_semana, campos) => sb.from('horario').update(campos).eq('dia_semana', dia_semana).then(ok),
    salvarConfig: (campos) => sb.from('config').update(campos).eq('id', 1).then(ok),
    registrar: (texto) => sb.from('historico').insert({ texto: texto.slice(0, 300) }).then(ok),
    async visitas(telefone) {
      if (!telefone) return [];
      return ok(await sb.from('agendamentos').select('dia,servico,status')
        .eq('telefone', telefone).in('status', ['chegou', 'faltou']).order('dia', { ascending: false }).limit(50));
    },
  };
}
