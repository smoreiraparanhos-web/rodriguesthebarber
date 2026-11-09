-- =====================================================================
-- Rodrigues TheBarber · banco de dados do painel (Supabase)
--
-- Como usar: no Supabase, abra SQL Editor > New query, cole este arquivo
-- inteiro e clique em Run. Pode rodar de novo depois de uma atualização:
-- ele não apaga nenhum dado.
--
-- Segurança:
--   * O público (site) não lê nem escreve nenhuma tabela diretamente.
--     Ele só chama três funções: servicos_publicos, disponibilidade e
--     solicitar_agendamento, que validam tudo no servidor.
--   * Só os e-mails da tabela "admins" (Tiago e suporte) leem e mudam
--     os dados, pelas regras de RLS (Row Level Security).
-- =====================================================================

create extension if not exists btree_gist;

-- ---------- quem pode entrar no painel ----------
create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  nome text not null,
  papel text not null check (papel in ('dono', 'suporte')),
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;

-- ---------- ajustes gerais ----------
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  recebendo boolean not null default true,              -- pedidos pelo site ligados?
  antecedencia_dias int not null default 60 check (antecedencia_dias between 1 and 365),
  aviso_minimo_min int not null default 60 check (aviso_minimo_min between 0 and 1440),
  passo_min int not null default 30 check (passo_min in (15, 20, 30, 60)),
  max_pendentes_por_telefone int not null default 3 check (max_pendentes_por_telefone between 1 and 20),
  atualizado_em timestamptz not null default now()
);
alter table public.config enable row level security;
insert into public.config (id) values (1) on conflict do nothing;
-- pedidos do site já entram confirmados (o Tiago só mexe se quiser remarcar ou recusar)
alter table public.config add column if not exists confirmacao_automatica boolean not null default true;

-- ---------- serviços e preços (o site lê daqui) ----------
create table if not exists public.servicos (
  id bigint generated always as identity primary key,
  nome text not null unique check (length(trim(nome)) between 1 and 60),
  detalhe text check (length(detalhe) <= 200),
  categoria text not null default 'Cortes'
    check (categoria in ('Cortes', 'Barba e alinhamento', 'Pigmentação', 'Luzes e cor', 'Combo')),
  preco numeric(8, 2) check (preco >= 0),               -- vazio = "a combinar"
  duracao_min int not null default 45 check (duracao_min between 5 and 480),
  destaque boolean not null default false,              -- estrela "o mais pedido"
  agendavel boolean not null default true,              -- aparece no formulário do site
  ativo boolean not null default true,                  -- aparece no site
  ordem int not null default 0,
  atualizado_em timestamptz not null default now()
);
alter table public.servicos enable row level security;

-- ---------- horário de funcionamento (0 = domingo) ----------
create table if not exists public.horario (
  dia_semana int primary key check (dia_semana between 0 and 6),
  aberto boolean not null default true,
  abre time not null default '09:00',
  fecha time not null default '20:00',
  check (fecha > abre)
);
alter table public.horario enable row level security;
insert into public.horario (dia_semana, aberto, abre, fecha) values
  (0, true, '09:00', '12:00'), (1, true, '09:00', '20:00'), (2, true, '09:00', '20:00'),
  (3, true, '09:00', '20:00'), (4, true, '09:00', '20:00'), (5, true, '09:00', '20:00'),
  (6, true, '09:00', '20:00')
on conflict do nothing;

-- ---------- folgas, feriados e horários bloqueados ----------
create table if not exists public.dias_fechados (
  dia date primary key,
  motivo text check (length(motivo) <= 80)
);
alter table public.dias_fechados enable row level security;

create table if not exists public.bloqueios (
  id bigint generated always as identity primary key,
  dia date not null,
  hora time not null,
  duracao_min int not null check (duracao_min between 5 and 720),
  motivo text not null default 'Bloqueado' check (length(motivo) <= 80),
  periodo tsrange generated always as (tsrange(dia + hora, dia + hora + make_interval(mins => duracao_min))) stored,
  criado_em timestamptz not null default now()
);
alter table public.bloqueios enable row level security;
create index if not exists bloqueios_dia on public.bloqueios (dia);

-- ---------- agendamentos ----------
create table if not exists public.agendamentos (
  id bigint generated always as identity primary key,
  request_id uuid unique,                               -- evita pedido duplicado se o cliente reenviar
  nome text not null check (length(trim(nome)) between 1 and 80),
  telefone text not null default '' check (length(telefone) <= 20),
  servico text not null check (length(servico) <= 60),
  preco numeric(8, 2),                                  -- preço no dia do pedido
  duracao_min int not null check (duracao_min between 5 and 480),
  dia date not null,
  hora time not null,
  periodo tsrange generated always as (tsrange(dia + hora, dia + hora + make_interval(mins => duracao_min))) stored,
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmado', 'chegou', 'faltou', 'cancelado', 'recusado')),
  origem text not null default 'site' check (origem in ('site', 'balcão', 'WhatsApp', 'telefone')),
  observacao text not null default '' check (length(observacao) <= 300),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- dois clientes nunca ocupam o mesmo horário, nem se pedirem no mesmo segundo
  constraint sem_conflito exclude using gist (periodo with &&)
    where (status in ('pendente', 'confirmado', 'chegou'))
);
alter table public.agendamentos enable row level security;
create index if not exists agendamentos_dia on public.agendamentos (dia);
create index if not exists agendamentos_telefone on public.agendamentos (telefone);

-- ---------- histórico: quem mudou o quê ----------
create table if not exists public.historico (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  quem text not null default lower(coalesce(auth.jwt() ->> 'email', 'sistema')),
  texto text not null check (length(texto) between 1 and 300)
);
alter table public.historico enable row level security;
create index if not exists historico_quando on public.historico (quando desc);

-- ---------- data de atualização automática ----------
create or replace function public.marcar_atualizado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists servicos_atualizado on public.servicos;
create trigger servicos_atualizado before update on public.servicos
  for each row execute function public.marcar_atualizado();
drop trigger if exists agendamentos_atualizado on public.agendamentos;
create trigger agendamentos_atualizado before update on public.agendamentos
  for each row execute function public.marcar_atualizado();
drop trigger if exists config_atualizado on public.config;
create trigger config_atualizado before update on public.config
  for each row execute function public.marcar_atualizado();

-- =====================================================================
-- Permissões
-- =====================================================================

-- quem está logado é admin?
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

-- nome e papel de quem está logado (vazio para quem não tem acesso)
create or replace function public.meu_papel() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('email', email, 'nome', nome, 'papel', papel)
  from admins where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

do $$
declare t text;
begin
  foreach t in array array['admins', 'config', 'servicos', 'horario', 'dias_fechados', 'bloqueios', 'agendamentos', 'historico'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists admin_le on public.%I', t);
    execute format('drop policy if exists admin_muda on public.%I', t);
  end loop;
end $$;

-- leitura: só admins
create policy admin_le on public.admins for select to authenticated using (public.eh_admin());
create policy admin_le on public.config for select to authenticated using (public.eh_admin());
create policy admin_le on public.servicos for select to authenticated using (public.eh_admin());
create policy admin_le on public.horario for select to authenticated using (public.eh_admin());
create policy admin_le on public.dias_fechados for select to authenticated using (public.eh_admin());
create policy admin_le on public.bloqueios for select to authenticated using (public.eh_admin());
create policy admin_le on public.agendamentos for select to authenticated using (public.eh_admin());
create policy admin_le on public.historico for select to authenticated using (public.eh_admin());

-- mudança: só admins. A lista de admins só muda pelo próprio Supabase.
create policy admin_muda on public.config for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy admin_muda on public.servicos for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy admin_muda on public.horario for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy admin_muda on public.dias_fechados for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy admin_muda on public.bloqueios for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy admin_muda on public.agendamentos for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
-- o histórico só aceita linhas novas com o e-mail de quem está logado; ninguém apaga nem edita
create policy admin_muda on public.historico for insert to authenticated
  with check (public.eh_admin() and quem = lower(auth.jwt() ->> 'email'));

revoke all on public.admins from authenticated;
grant select on public.admins to authenticated;
revoke all on public.historico from authenticated;
grant select, insert on public.historico to authenticated;

-- =====================================================================
-- Funções públicas usadas pelo site
-- =====================================================================

-- serviços, preços e horários para o site
create or replace function public.servicos_publicos() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'enabled', c.recebendo,
    'advanceDays', c.antecedencia_dias,
    'services', coalesce((
      select json_object_agg(s.nome, s.duracao_min order by s.ordem, s.id)
      from servicos s where s.ativo and s.agendavel), '{}'::json),
    'catalogo', coalesce((
      select json_agg(json_build_object(
        'nome', s.nome, 'detalhe', s.detalhe, 'categoria', s.categoria,
        'preco', s.preco, 'destaque', s.destaque) order by s.ordem, s.id)
      from servicos s where s.ativo), '[]'::json),
    'horario', (
      select json_agg(json_build_object(
        'dia', h.dia_semana, 'aberto', h.aberto,
        'abre', to_char(h.abre, 'HH24:MI'), 'fecha', to_char(h.fecha, 'HH24:MI')) order by h.dia_semana)
      from horario h),
    'fechados', coalesce((
      select json_agg(to_char(f.dia, 'YYYY-MM-DD') order by f.dia)
      from dias_fechados f
      where f.dia between (now() at time zone 'America/Sao_Paulo')::date
                      and (now() at time zone 'America/Sao_Paulo')::date + 14), '[]'::json)
  )
  from config c where c.id = 1
$$;

-- horários livres de um dia para um serviço
create or replace function public.disponibilidade(p_dia date, p_servico text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  cfg config;
  srv servicos;
  h horario;
  agora timestamp := now() at time zone 'America/Sao_Paulo';
  t timestamp;
  fim timestamp;
  slots text[] := '{}';
begin
  select * into cfg from config where id = 1;
  if not cfg.recebendo then
    return json_build_object('enabled', false, 'slots', '[]'::json);
  end if;

  select * into srv from servicos where nome = p_servico and ativo and agendavel;
  if not found then
    raise exception 'Serviço não encontrado. Recarregue a página.';
  end if;

  if p_dia is null or p_dia < agora::date or p_dia > agora::date + cfg.antecedencia_dias
     or exists (select 1 from dias_fechados where dia = p_dia) then
    return json_build_object('enabled', true, 'slots', '[]'::json, 'duration', srv.duracao_min);
  end if;

  select * into h from horario where dia_semana = extract(dow from p_dia)::int;
  if not found or not h.aberto then
    return json_build_object('enabled', true, 'slots', '[]'::json, 'duration', srv.duracao_min);
  end if;

  t := p_dia + h.abre;
  loop
    fim := t + make_interval(mins => srv.duracao_min);
    exit when fim > p_dia + h.fecha;
    if t >= agora + make_interval(mins => cfg.aviso_minimo_min)
       and not exists (select 1 from agendamentos a
                       where a.status in ('pendente', 'confirmado', 'chegou') and a.periodo && tsrange(t, fim))
       and not exists (select 1 from bloqueios b where b.periodo && tsrange(t, fim)) then
      slots := slots || to_char(t, 'HH24:MI');
    end if;
    t := t + make_interval(mins => cfg.passo_min);
  end loop;

  return json_build_object('enabled', true, 'slots', to_json(slots), 'duration', srv.duracao_min);
end $$;

-- pedido de agendamento vindo do site
create or replace function public.solicitar_agendamento(
  p_request_id uuid,
  p_nome text,
  p_telefone text,
  p_servico text,
  p_dia date,
  p_hora text,
  p_observacao text default '',
  p_website text default ''
) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg config;
  srv servicos;
  v_nome text := trim(coalesce(p_nome, ''));
  v_tel text := trim(coalesce(p_telefone, ''));
  v_digitos text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_obs text := trim(coalesce(p_observacao, ''));
  v_livres json;
  v_id bigint;
  v_status text;
begin
  -- campo-isca preenchido: é robô. Responde como se tivesse recebido e não grava nada.
  if coalesce(p_website, '') <> '' then
    return json_build_object('received', true, 'status', 'pending');
  end if;

  -- o mesmo pedido enviado de novo não vira um segundo agendamento
  select id, status into v_id, v_status from agendamentos where request_id = p_request_id;
  if found then
    return json_build_object('id', v_id, 'received', true, 'status', case when v_status = 'pendente' then 'pending' else 'confirmed' end);
  end if;

  if p_request_id is null then raise exception 'Pedido inválido. Recarregue a página.'; end if;
  if length(v_nome) < 1 or length(v_nome) > 80 then raise exception 'Informe seu nome.'; end if;
  if v_digitos !~ '^(55)?[1-9][0-9][0-9]{8,9}$' or length(v_tel) > 20 then
    raise exception 'Informe o WhatsApp com DDD, por exemplo (51) 99999-9999.';
  end if;
  if length(v_obs) > 300 then raise exception 'A observação pode ter até 300 letras.'; end if;

  select * into cfg from config where id = 1;
  if not cfg.recebendo then
    raise exception 'Os pedidos pelo site estão pausados no momento. Fale com a barbearia pelo WhatsApp.';
  end if;

  select * into srv from servicos where nome = p_servico and ativo and agendavel;
  if not found then raise exception 'Serviço não encontrado. Recarregue a página.'; end if;

  -- limite de horários futuros marcados pelo site para o mesmo telefone
  if (select count(*) from agendamentos
      where origem = 'site' and status in ('pendente', 'confirmado')
        and dia >= (now() at time zone 'America/Sao_Paulo')::date
        and regexp_replace(telefone, '\D', '', 'g') = v_digitos) >= cfg.max_pendentes_por_telefone then
    raise exception 'Você já tem horários marcados pelo site. Para marcar mais, fale com a barbearia pelo WhatsApp.';
  end if;

  if (select count(*) from agendamentos
      where origem = 'site' and criado_em > now() - interval '10 minutes') >= 30 then
    raise exception 'Muitos pedidos ao mesmo tempo. Tente de novo em alguns minutos.';
  end if;

  v_livres := public.disponibilidade(p_dia, p_servico) -> 'slots';
  if not exists (select 1 from json_array_elements_text(v_livres) x where x = p_hora) then
    raise exception 'Esse horário foi ocupado ou não está disponível. Escolha outro.';
  end if;

  begin
    v_status := case when cfg.confirmacao_automatica then 'confirmado' else 'pendente' end;
    insert into agendamentos (request_id, nome, telefone, servico, preco, duracao_min, dia, hora, origem, observacao, status)
    values (p_request_id, v_nome, v_tel, srv.nome, srv.preco, srv.duracao_min, p_dia, p_hora::time, 'site', v_obs, v_status)
    returning id into v_id;
  exception
    when exclusion_violation then
      raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
    when unique_violation then
      select id, status into v_id, v_status from agendamentos where request_id = p_request_id;
  end;

  return json_build_object('id', v_id, 'received', true, 'status', case when v_status = 'pendente' then 'pending' else 'confirmed' end);
end $$;

-- o site só chama estas funções; o painel usa meu_papel
revoke all on function public.servicos_publicos() from public, anon, authenticated;
revoke all on function public.disponibilidade(date, text) from public, anon, authenticated;
revoke all on function public.solicitar_agendamento(uuid, text, text, text, date, text, text, text) from public, anon, authenticated;
revoke all on function public.meu_papel() from public, anon, authenticated;
revoke all on function public.eh_admin() from public, anon, authenticated;
revoke all on function public.marcar_atualizado() from public, anon, authenticated;
grant execute on function public.servicos_publicos() to anon, authenticated;
grant execute on function public.disponibilidade(date, text) to anon, authenticated;
grant execute on function public.solicitar_agendamento(uuid, text, text, text, date, text, text, text) to anon, authenticated;
grant execute on function public.meu_papel() to authenticated;
grant execute on function public.eh_admin() to authenticated;

-- avisos em tempo real no painel quando chega pedido novo
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agendamentos') then
    alter publication supabase_realtime add table public.agendamentos;
  end if;
end $$;

-- =====================================================================
-- Serviços iniciais (só entram se a tabela estiver vazia)
-- =====================================================================
insert into public.servicos (nome, detalhe, categoria, preco, duracao_min, destaque, ordem)
select * from (values
  ('Corte degradê', 'na 0 ou na 1', 'Cortes', 35, 45, false, 10),
  ('Low, mid ou high fade', null, 'Cortes', 40, 45, false, 20),
  ('Skin fade navalhado', 'o mais pedido', 'Cortes', 40, 45, true, 30),
  ('Corte do jaca', null, 'Cortes', 45, 45, false, 40),
  ('Executivo ou pente corrido', null, 'Cortes', 45, 45, false, 50),
  ('Corte infantil', null, 'Cortes', 35, 45, false, 60),
  ('Contorno desenhado', 'pezinho', 'Barba e alinhamento', 25, 15, false, 70),
  ('Barba aparada', null, 'Barba e alinhamento', 35, 30, false, 80),
  ('Barba feita na navalha', 'tradicional', 'Barba e alinhamento', 25, 30, true, 90),
  ('Pigmentação no cabelo', null, 'Pigmentação', 35, 60, false, 100),
  ('Pigmentação na barba', null, 'Pigmentação', 20, 30, false, 110),
  ('Sobrancelha', null, 'Pigmentação', 15, 15, false, 120),
  ('Luzes curtas', 'cabelo até 5 cm', 'Luzes e cor', 50, 120, false, 130),
  ('Luzes médias', 'cabelo até 10 cm', 'Luzes e cor', 75, 120, false, 140),
  ('Platinado', null, 'Luzes e cor', 180, 180, false, 150),
  ('Freestyle e desenho', null, 'Luzes e cor', null, 60, false, 160),
  ('Ritual Rodrigues', 'Corte em qualquer estilo, pigmentação completa no cabelo, barba feita e sobrancelha. O alinhamento completo, de uma vez só.', 'Combo', 100, 90, false, 170)
) as v(nome, detalhe, categoria, preco, duracao_min, destaque, ordem)
where not exists (select 1 from public.servicos);
