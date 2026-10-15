import 'dotenv/config';
import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 8765);
const host = process.env.HOST || '127.0.0.1';
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : randomBytes(32).toString('base64url'));
const sessionTtlSeconds = 8 * 60 * 60;
const cookieName = 'oraculo_session';
const googleAuth = googleClientId ? new OAuth2Client(googleClientId) : null;

if (!sessionSecret) {
  console.error('Defina SESSION_SECRET com um valor aleatório forte antes de iniciar em produção.');
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.warn('Usando uma chave de sessão temporária de desenvolvimento. Configure SESSION_SECRET para manter sessões entre reinícios.');
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8'
};

const sendJson = (response, status, body, extraHeaders = {}) => {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
};

const isSecureRequest = (request) => {
  if (request.socket.encrypted) return true;
  return process.env.TRUST_PROXY === 'true' && request.headers['x-forwarded-proto'] === 'https';
};

const cookieOptions = (request, maxAge) => [
  `${cookieName}=`,
  'Path=/',
  'HttpOnly',
  'SameSite=Lax',
  `Max-Age=${maxAge}`,
  ...(isSecureRequest(request) ? ['Secure'] : [])
].join('; ');

const signSession = (session) => {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const readSession = (request) => {
  const cookies = request.headers.cookie?.split(';') || [];
  const cookie = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  if (!token) return null;

  const [encodedPayload, receivedSignature, extra] = token.split('.');
  if (!encodedPayload || !receivedSignature || extra !== undefined) return null;
  const expectedSignature = createHmac('sha256', sessionSecret).update(encodedPayload).digest();
  let suppliedSignature;
  try {
    suppliedSignature = Buffer.from(receivedSignature, 'base64url');
  } catch {
    return null;
  }
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const session = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!session.sub || !session.exp || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
};

const sameOrigin = (request) => {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    const requestUrl = new URL(request.url, `${isSecureRequest(request) ? 'https' : 'http'}://${request.headers.host}`);
    return new URL(origin).origin === requestUrl.origin;
  } catch {
    return false;
  }
};

const readJsonBody = async (request, maxBytes = 16 * 1024) => {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('A solicitação excede o limite permitido.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('A solicitação não contém JSON válido.'), { status: 400 });
  }
};

const handleGoogleLogin = async (request, response) => {
  if (!sameOrigin(request)) return sendJson(response, 403, { message: 'Origem da solicitação não autorizada.' });
  if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
    return sendJson(response, 415, { message: 'Envie a credencial em JSON.' });
  }
  if (!googleClientId || !googleAuth) {
    return sendJson(response, 503, { message: 'O login Google ainda não foi configurado neste site.' });
  }

  try {
    const { credential } = await readJsonBody(request);
    if (typeof credential !== 'string' || credential.length < 100) {
      return sendJson(response, 400, { message: 'A credencial do Google está ausente ou inválida.' });
    }

    const ticket = await googleAuth.verifyIdToken({ idToken: credential, audience: googleClientId });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      return sendJson(response, 403, { message: 'A conta Google não forneceu um endereço de e-mail verificado.' });
    }

    const session = {
      sub: profile.sub,
      email: profile.email,
      name: profile.name || '',
      picture: profile.picture || '',
      exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds
    };
    const user = { email: session.email, name: session.name, picture: session.picture };
    return sendJson(response, 200, { authenticated: true, user }, {
      'Set-Cookie': `${cookieName}=${signSession(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionTtlSeconds}${isSecureRequest(request) ? '; Secure' : ''}`
    });
  } catch (error) {
    const status = error.status || 401;
    return sendJson(response, status, {
      message: status === 401 ? 'O Google não confirmou esta conta. Tente entrar novamente.' : error.message
    });
  }
};

const serveStaticFile = async (request, response, pathname) => {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end('Caminho inválido.');
    return;
  }

  if (decodedPath.includes('\0')) {
    response.writeHead(400).end('Caminho inválido.');
    return;
  }
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const segments = relativePath.split(/[\\/]+/);
  if (segments.some((segment) => segment === '..' || segment.startsWith('.'))) {
    response.writeHead(404).end('Não encontrado.');
    return;
  }

  const isAsset = segments[0] === 'assets' && segments.length > 1;
  const allowedRootFiles = new Set(['index.html', 'styles.css', 'script.js']);
  if (!isAsset && !allowedRootFiles.has(relativePath)) {
    response.writeHead(404).end('Não encontrado.');
    return;
  }

  const filePath = resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${sep}`) && filePath !== root) {
    response.writeHead(404).end('Não encontrado.');
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) throw new Error('Não é arquivo.');
    const content = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Length': content.length,
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404).end('Não encontrado.');
  }
};

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const { pathname } = requestUrl;

  if (request.method === 'GET' && pathname === '/config.json') {
    return sendJson(response, 200, { googleClientId });
  }
  if (request.method === 'GET' && pathname === '/health') {
    return sendJson(response, 200, { status: 'ok' });
  }
  if (request.method === 'GET' && pathname === '/api/session') {
    const session = readSession(request);
    if (!session) return sendJson(response, 200, { authenticated: false });
    return sendJson(response, 200, {
      authenticated: true,
      user: { email: session.email, name: session.name, picture: session.picture }
    });
  }
  if (request.method === 'POST' && pathname === '/api/auth/google') {
    return handleGoogleLogin(request, response);
  }
  if (request.method === 'POST' && pathname === '/api/logout') {
    if (!sameOrigin(request) || request.headers['x-csrf-protection'] !== '1') {
      return sendJson(response, 403, { message: 'Solicitação de saída não autorizada.' });
    }
    return sendJson(response, 200, { authenticated: false }, { 'Set-Cookie': cookieOptions(request, 0) });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD, POST' }).end('Método não permitido.');
    return;
  }
  return serveStaticFile(request, response, pathname);
});

server.listen(port, host, () => {
  console.log(`O Oráculo da Praça disponível em http://${host}:${port}`);
  console.log(googleClientId ? 'Login Google configurado.' : 'Login Google aguardando GOOGLE_CLIENT_ID.');
});
