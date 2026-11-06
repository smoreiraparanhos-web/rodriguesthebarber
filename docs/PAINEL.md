# Painel do Tiago: como colocar no ar

O painel fica em `https://smoreiraparanhos-web.github.io/rodriguesthebarber/painel/`.
O site e o painel são separados, mas usam o mesmo banco de dados (Supabase):

```
 Site público  ──(só 3 funções: serviços, horários livres, pedir horário)──►  Banco (Supabase)
 Painel        ──(login Google, só os e-mails liberados)──────────────────►  Banco (Supabase)
```

Enquanto o arquivo `js/config.js` estiver vazio:
- o site continua usando a agenda antiga;
- o painel abre em **modo demonstração**, com dados de exemplo.

Nada quebra até você terminar o passo 6.

Tempo total: uns 40 minutos, uma vez só.

---

## 1. Criar o projeto no Supabase (grátis)

1. Entre em https://supabase.com e crie uma conta (pode usar a conta do GitHub).
2. **New project**:
   - Name: `rodrigues-thebarber`
   - Database password: clique em **Generate** e guarde no gerenciador de senhas
   - Region: **South America (São Paulo)**
3. Espere o projeto ficar pronto (1 a 2 minutos).

## 2. Criar as tabelas e as regras de segurança

1. No menu da esquerda, abra **SQL Editor** > **New query**.
2. Copie todo o conteúdo do arquivo `supabase/schema.sql` deste repositório, cole e clique em **Run**.
3. Deve aparecer "Success. No rows returned".

Se um dia o arquivo for atualizado, é só rodar de novo: ele não apaga dados.

## 3. Dizer quem pode entrar no painel

Ainda no SQL Editor, rode (troque pelos e-mails Google de verdade):

```sql
insert into admins (email, nome, papel) values
  ('email-do-tiago@gmail.com', 'Tiago', 'dono'),
  ('seu-email@gmail.com', 'Suporte', 'suporte');
```

Os e-mails precisam estar **em letras minúsculas**. Para tirar alguém:

```sql
delete from admins where email = 'email@gmail.com';
```

A lista só muda por aqui, nunca pelo painel. Assim, mesmo que alguém entre no painel, não consegue se dar acesso.

## 4. Ligar o login com Google

### 4a. No Google Cloud

1. Abra https://console.cloud.google.com e crie um projeto (ex.: "Painel Rodrigues").
2. Abra **APIs e serviços** > **Tela de consentimento OAuth** (ou "Google Auth Platform"):
   - Tipo: **Externo**
   - Nome do app: `Painel Rodrigues TheBarber`
   - E-mail de suporte: o seu
   - Em **Público-alvo** (ou "Usuários de teste"), adicione o e-mail do Tiago e o seu.
   - Deixe o app em modo **Teste**. Assim, só esses dois e-mails conseguem passar pelo login do Google, o que é uma proteção a mais.
3. Abra **Credenciais** > **Criar credenciais** > **ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - Origens JavaScript autorizadas: `https://smoreiraparanhos-web.github.io`
   - URIs de redirecionamento autorizados: `https://SEU-PROJETO.supabase.co/auth/v1/callback`
     (o endereço exato aparece no Supabase, no passo 4b)
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.

### 4b. No Supabase

1. **Authentication** > **Sign In / Providers** > **Google**: ative, cole o ID do cliente e a chave secreta e salve.
   Nessa tela aparece o "Callback URL", que é o endereço usado no passo 4a.3.
2. Ainda em **Sign In / Providers**, desative o **Email**. O painel só usa Google.
3. **Authentication** > **URL Configuration**:
   - Site URL: `https://smoreiraparanhos-web.github.io/rodriguesthebarber/painel/`
   - Redirect URLs: adicione o mesmo endereço.

## 5. Ligar o site e o painel ao banco

1. No Supabase, abra **Project Settings** > **API Keys** e copie a **Publishable key** (começa com `sb_publishable_`).
   Se só aparecer a chave antiga, use a **anon public** (começa com `eyJ`).
2. Em **Project Settings** > **Data API** (ou **API**), copie o **Project URL** (ex.: `https://abcdefgh.supabase.co`).
3. Edite o arquivo `js/config.js` e preencha os dois campos:

```js
export const SUPABASE = {
  url: 'https://abcdefgh.supabase.co',
  chave: 'sb_publishable_...',
};
```

Essa chave é pública de propósito: quem protege os dados são as regras do banco (passo 2).
**Nunca** coloque no site a chave `secret` nem a `service_role`.

## 6. Publicar e testar

1. Publique (commit) no GitHub e espere 1 a 2 minutos.
2. Abra o painel `.../rodriguesthebarber/painel/` e entre com a sua conta Google. Deve abrir a tela "Hoje".
3. Entre com uma conta Google que **não** está na lista. Deve aparecer "Acesso negado".
4. No painel, em **Ajustes**, mude o preço de um serviço. Abra o site e confira a "Tabela da casa".
5. No site, faça um pedido de teste. Ele aparece em **Pedidos** no painel. Recuse o pedido.
6. No celular do Tiago, abra o painel e use **Compartilhar** > **Adicionar à tela de início**. Ele vira um "app".

## Como os pedidos chegam (WhatsApp)

1. O cliente agenda no site. O horário **já fica reservado** e some do site para os outros clientes.
2. O site mostra "Horário reservado!" e o botão **Enviar no WhatsApp**. O WhatsApp do cliente abre com a mensagem formatada para a barbearia, e ele só toca em enviar.
3. A mensagem tem o **número do pedido** (ex.: "Pedido nº 0006"). Para mexer nele, o Tiago abre o painel, vai em **Pedidos** e toca no pedido. Os últimos aparecem no topo, e dá para buscar pelo número.
4. No pedido, o Tiago escolhe:
   - **Mandar confirmação no WhatsApp:** abre a resposta pronta para o cliente.
   - **Remarcar:** escolhe o novo horário, e a mensagem para o cliente já sai pronta.
   - **Recusar e liberar o horário:** o horário volta a aparecer no site, e o aviso para o cliente já sai pronto.

Se o Tiago não fizer nada, o horário continua reservado. Para voltar a confirmar pedido por pedido, desligue **"Confirmar sozinho os pedidos do site"** em Ajustes.

## Quando o arquivo supabase/schema.sql mudar

Abra **SQL Editor** > **New query**, cole o arquivo inteiro de novo e clique em **Run**. Ele não apaga dados.
Faça isso **antes** de juntar o pull request que trouxe a mudança.

## Depois que estiver funcionando

- **Avisos de pedido novo:** em Ajustes, toque em "Avisar neste aparelho quando chegar pedido". O aviso aparece enquanto o painel estiver aberto, mesmo em outra aba.
- **Pedidos que já estavam no painel antigo:** o painel antigo continua no ar. Confira se ficou algum pedido pendente lá e coloque no painel novo com **+ Encaixar cliente**.
- **Projeto pausado:** no plano grátis, o Supabase pausa projetos sem nenhum uso por 7 dias. Com o site recebendo visitas e o Tiago usando o painel, isso não deve acontecer. Se acontecer, basta entrar no Supabase e clicar em **Restore**.
- **Cópia de segurança:** o plano grátis não guarda cópias automáticas que você possa baixar. Uma vez por mês, abra **Table Editor** > `agendamentos` > **Export to CSV** e guarde o arquivo. O plano Pro (US$ 25/mês) faz cópia diária.

## O que cada arquivo faz

| Arquivo | Para quê |
|---|---|
| `supabase/schema.sql` | Tabelas, regras de segurança e funções do banco |
| `js/config.js` | Endereço e chave pública do banco (site e painel) |
| `painel/index.html`, `painel.css`, `painel.js` | Telas do painel |
| `painel/dados.js` | Conversa com o banco |
| `painel/dados-demo.js` | Modo demonstração (sem banco) |
| `painel/vendor/supabase-2.118.0.js` | Biblioteca oficial do Supabase, guardada no próprio site |
