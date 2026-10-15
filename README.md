# O Oráculo da Praça

Site de apresentação com quiz e login Google opcional.

## Executar localmente

1. Instale o Node.js 20 ou superior.
2. Copie `.env.example` para `.env` e preencha o ID de cliente Google e a chave de sessão.
3. Execute `npm install` e depois `npm start`.
4. Abra `http://127.0.0.1:8765`.

Veja [CONFIGURAR_LOGIN_GOOGLE.md](CONFIGURAR_LOGIN_GOOGLE.md) para criar o OAuth Client ID e autorizar as origens.

## Publicar no Render

O arquivo `render.yaml` prepara um serviço Node gratuito, com verificação de saúde e chave de sessão gerada pelo Render. O deploy exige que este repositório esteja no GitHub, GitLab ou Bitbucket. Durante a criação do serviço, configure `GOOGLE_CLIENT_ID` com o ID do cliente OAuth da aplicação e inclua o domínio Render nas origens JavaScript autorizadas do Google.

O login só identifica a conta nesta versão; o site ainda não tem área de aulas, matrícula ou checkout.
