// Ligação com o banco de dados do painel (Supabase).
//
// Enquanto os dois campos estiverem vazios, o site continua usando a agenda antiga.
// Depois de criar o projeto no Supabase (passo a passo em docs/PAINEL.md), copie:
//   url:   Project Settings > API > Project URL      (ex.: https://abcdefgh.supabase.co)
//   chave: Project Settings > API Keys > Publishable key (começa com sb_publishable_)
//          ou a "anon public" key antiga (começa com eyJ)
// Essa chave é pública de propósito: quem protege os dados são as regras do banco.
// NUNCA coloque aqui a "secret" ou "service_role" key.

export const SUPABASE = {
  url: '',
  chave: '',
};
