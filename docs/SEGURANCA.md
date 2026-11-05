# Segurança do site Rodrigues TheBarber

## Como o site funciona

O site é feito só de páginas, imagens e scripts. Ele não tem banco de dados, login nem plugins.
O único ponto que recebe dados é o formulário de agendamento. Ele envia o pedido para a agenda
do Tiago (`rodrigues-painel-tiago.adeptcharm4.chatgpt.site`), que é um sistema separado.

Um site assim não pega vírus sozinho. Os riscos reais são:

1. alguém entrar numa conta sua (GitHub, e-mail, painel da agenda) e trocar o site;
2. um código de fora ser colocado no site;
3. robôs mandando pedidos falsos pelo formulário.

## O que já protege o site

- **Proteção no `index.html` (Content-Security-Policy).** O navegador só roda os scripts do
  próprio site, só busca fontes no Google Fonts, só conversa com a agenda do Tiago e só abre
  o mapa do Google. Qualquer outro código colocado na página é bloqueado.
- **Links externos** (WhatsApp, Instagram, Google) abrem em outra aba com `noopener noreferrer`:
  a página aberta não consegue mexer no site.
- **Formulário:**
  - tudo que vem da agenda ou do cliente é tratado como texto, nunca vira código na página;
  - campo-isca escondido para pegar robôs;
  - limite de tamanho no nome, no WhatsApp e na observação;
  - cada pedido tem um número único, então reenviar não duplica o pedido.
- **A agenda antiga só aceita pedidos de `https://smoreiraparanhos-web.github.io`.**
- **Painel novo (Supabase):**
  - o banco só deixa os e-mails da tabela `admins` ler e mudar os dados, mesmo que alguém descubra o endereço do painel;
  - o site só usa três funções que conferem tudo no servidor: dia, horário livre, telefone válido, no máximo 3 pedidos aguardando por telefone e limite de pedidos por minuto;
  - dois clientes nunca ficam com o mesmo horário, nem pedindo no mesmo segundo;
  - o histórico guarda quem fez cada mudança e ninguém consegue apagar ou falsificar o autor;
  - a lista de quem entra só muda dentro do Supabase. Passo a passo em `docs/PAINEL.md`.
- **Arquivo `_headers`:** obriga HTTPS, impede que o site seja aberto dentro de outro site e
  bloqueia câmera, microfone e localização. Só funciona no Netlify ou no Cloudflare Pages.
  No GitHub Pages ele é ignorado, mas a proteção do `index.html` continua valendo.

## Ao mudar o código

- Se mudar o script pequeno no `<head>` do `index.html`
  (`document.documentElement.classList.add('js')`), o navegador passa a bloquear esse script.
  Gere o novo código e troque o `sha256-...` na linha `Content-Security-Policy`:

  ```bash
  printf '%s' "document.documentElement.classList.add('js')" | openssl dgst -sha256 -binary | base64
  ```

- Se a agenda antiga mudar de endereço, troque o endereço em `js/main.js` (`API`) **e** no
  `connect-src` da linha `Content-Security-Policy`. Senão a agenda não carrega.
  O banco novo (`*.supabase.co`) já está liberado.
- Em `js/config.js` vai só a chave **pública** do Supabase. Nunca a `secret` nem a `service_role`.
- Se colocar um serviço novo (outro mapa, um vídeo, um chat), acrescente o endereço dele na
  linha `Content-Security-Policy`.

## Lista de tarefas para você

O mais importante depende das contas, não do código:

- [ ] Ative a verificação em duas etapas no GitHub, no Supabase e nas contas Google do Tiago e do suporte.
- [ ] Use senhas longas e diferentes em cada conta, guardadas num gerenciador de senhas.
- [ ] No GitHub, em Settings > Pages, deixe marcado **Enforce HTTPS**.
- [ ] Dê permissão para mexer no repositório a poucas pessoas.
- [ ] Confira de vez em quando os pedidos no painel. Se aparecerem muitos pedidos falsos,
      peça para quem cuida da agenda limitar quantos pedidos um mesmo endereço pode mandar.
- [ ] Se um dia tiver domínio próprio (ex.: `rodriguesthebarber.com.br`), ative o bloqueio de
      transferência do domínio e a verificação em duas etapas no registro.
