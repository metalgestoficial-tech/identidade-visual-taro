# Configurar o login Google

O site agora tem botão de login, validação da credencial no servidor e sessão em cookie `HttpOnly`. A credencial de identidade é verificada pelo servidor usando `google-auth-library`; o navegador não é tratado como autoridade para validar o usuário. O login não dá acesso a aulas ou compras: esta página ainda não tem uma área de membros.

## 1. Criar o cliente OAuth

No Google Cloud Console, selecione ou crie um projeto, configure a tela de consentimento OAuth e crie um **ID do cliente OAuth 2.0** do tipo **Aplicativo da Web**. Copie o ID que termina em `.apps.googleusercontent.com`.

Em **Origens JavaScript autorizadas**, adicione exatamente as origens que serão usadas. Para a prévia local atual, adicione as duas:

- `http://127.0.0.1:8765`
- `http://localhost:8765`

Para produção, adicione também a origem HTTPS do domínio publicado, por exemplo `https://seudominio.com`. O login usa o modo popup e não precisa de uma URI de redirecionamento neste fluxo.

## 2. Configurar o site

Na pasta deste site, copie `.env.example` para `.env` e preencha:

```dotenv
PORT=8765
HOST=127.0.0.1
GOOGLE_CLIENT_ID=SEU_ID.apps.googleusercontent.com
SESSION_SECRET=um-valor-aleatorio-com-pelo-menos-32-bytes
```

Gere uma chave de sessão aleatória com Node:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Não publique nem compartilhe o arquivo `.env`. O ID do cliente do Google é público por natureza; a chave `SESSION_SECRET` deve ficar somente no servidor.

## 3. Iniciar a página

Instale as dependências e inicie o servidor nesta pasta:

```powershell
npm install
npm start
```

Abra `http://127.0.0.1:8765`. O quiz continua funcionando sem login. Ao entrar, o servidor verifica o token emitido pelo Google e grava uma sessão assinada em cookie `HttpOnly`, com validade de oito horas.

## 4. Hospedagem

Em produção, use HTTPS, defina `NODE_ENV=production`, configure uma `SESSION_SECRET` forte e sirva o site por um proxy confiável. Se o proxy encerrar o HTTPS antes do Node, defina `TRUST_PROXY=true`. Configure no cliente OAuth a origem HTTPS pública. Não exponha a porta do servidor de desenvolvimento diretamente à internet.

Referências oficiais:

- [Criar um ID de cliente do Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Verificar o token de ID no servidor](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
