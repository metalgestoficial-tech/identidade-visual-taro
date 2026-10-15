const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('#menu-principal');

const closeMenu = () => {
  menu?.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', 'Abrir menu');
};

toggle?.addEventListener('click', () => {
  const isOpen = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!isOpen));
  toggle.setAttribute('aria-label', isOpen ? 'Abrir menu' : 'Fechar menu');
  menu?.classList.toggle('is-open', !isOpen);
});

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMenu);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

document.addEventListener('click', (event) => {
  if (!menu?.contains(event.target) && !toggle?.contains(event.target)) closeMenu();
});

const quizForm = document.querySelector('#quiz-form');
const quizSteps = [...document.querySelectorAll('.quiz-step')];
const quizPanel = document.querySelector('#quiz-panel');
const quizResult = document.querySelector('#quiz-result');
const quizProgress = document.querySelector('.quiz-progress');
const quizProgressFill = document.querySelector('#quiz-progress-fill');
const quizStepLabel = document.querySelector('#quiz-step-label');
const quizStepCount = document.querySelector('#quiz-step-count');
const quizError = document.querySelector('#quiz-error');
const quizBack = document.querySelector('#quiz-back');
const quizNextLabel = document.querySelector('#quiz-next-label');
const quizResultTitle = document.querySelector('#quiz-result-title');
const quizResultCopy = document.querySelector('#quiz-result-copy');
const quizResultLink = document.querySelector('#quiz-result-link');
const quizResultAction = document.querySelector('#quiz-result-action');
const quizRetry = document.querySelector('#quiz-retry');

if (quizForm && quizSteps.length) {
  let activeStep = 0;
  const resultByInterest = {
    tarot: {
      title: 'Cartas e arquétipos podem ser seu primeiro caminho.',
      copy: 'No curso, imagens como Justiça, Roda da Fortuna e Sol abrem conversas sobre responsabilidade, mudança e clareza. A leitura inspira perguntas; não prevê o futuro.',
      link: '#modulo-taro',
      action: 'Ver o módulo de tarô'
    },
    astrologia: {
      title: 'Signos e mapa astral podem ser seu primeiro caminho.',
      copy: 'A proposta é explorar essa linguagem para observar padrões, desejos e limites, sem deixar os astros decidirem por você.',
      link: '#modulo-astro',
      action: 'Ver o módulo de astrologia'
    },
    escolhas: {
      title: 'Princípios e pensamento crítico parecem combinar com sua curiosidade.',
      copy: 'O curso conecta símbolos a perguntas e convida a organizar valores, opções e consequências, consultando informações e evidências quando necessário.',
      link: '#modulo-principios',
      action: 'Ver o módulo sobre decisões'
    },
    combinado: {
      title: 'Sua curiosidade atravessa mais de uma linguagem.',
      copy: 'O curso reúne tarô, astrologia e reflexão sobre escolhas. Você pode explorar os módulos e seguir a ordem que fizer sentido para você.',
      link: '#programa',
      action: 'Conhecer todos os módulos'
    }
  };

  const updateQuizStep = () => {
    quizSteps.forEach((step, index) => { step.hidden = index !== activeStep; });
    quizStepLabel.textContent = `PERGUNTA ${activeStep + 1} DE ${quizSteps.length}`;
    quizStepCount.textContent = `${activeStep + 1} / ${quizSteps.length}`;
    quizProgress.setAttribute('aria-valuenow', String(activeStep + 1));
    quizProgressFill.style.width = `${((activeStep + 1) / quizSteps.length) * 100}%`;
    quizBack.hidden = activeStep === 0;
    quizNextLabel.textContent = activeStep === quizSteps.length - 1 ? 'Ver meu resultado' : 'Continuar';
    quizError.hidden = true;
  };

  const showQuizResult = () => {
    const scores = { tarot: 0, astrologia: 0, escolhas: 0 };
    for (const value of new FormData(quizForm).values()) {
      if (Object.hasOwn(scores, value)) scores[value] += 1;
    }
    const highestScore = Math.max(...Object.values(scores));
    const leaders = Object.keys(scores).filter((key) => scores[key] === highestScore);
    const result = resultByInterest[leaders.length === 1 ? leaders[0] : 'combinado'];
    quizResultTitle.textContent = result.title;
    quizResultCopy.textContent = result.copy;
    quizResultLink.href = result.link;
    quizResultAction.textContent = result.action;
    quizPanel.hidden = true;
    quizResult.hidden = false;
    quizResult.focus();
  };

  quizForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const selected = quizSteps[activeStep].querySelector('input:checked');
    if (!selected) {
      quizError.hidden = false;
      return;
    }
    if (activeStep < quizSteps.length - 1) {
      activeStep += 1;
      updateQuizStep();
      quizSteps[activeStep].querySelector('input').focus();
      return;
    }
    showQuizResult();
  });

  quizBack.addEventListener('click', () => {
    if (activeStep > 0) {
      activeStep -= 1;
      updateQuizStep();
      quizSteps[activeStep].querySelector('input:checked')?.focus();
    }
  });

  quizRetry.addEventListener('click', () => {
    quizForm.reset();
    activeStep = 0;
    quizResult.hidden = true;
    quizPanel.hidden = false;
    updateQuizStep();
    quizSteps[activeStep].querySelector('input').focus();
  });

  updateQuizStep();
}

const loginDialog = document.querySelector('#login-dialog');
const loginStatus = document.querySelector('#login-status');
const googleButton = document.querySelector('#google-signin-button');
const loginUser = document.querySelector('#login-user');
const loginAvatar = document.querySelector('#login-avatar');
const loginName = document.querySelector('#login-name');
const loginEmail = document.querySelector('#login-email');
const loginSignout = document.querySelector('#login-signout');
let loginConfigPromise;
let googleServicesPromise;

const setLoginStatus = (message, state = '') => {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  loginStatus.dataset.state = state;
};

const loadLoginConfig = () => {
  if (!loginConfigPromise) {
    loginConfigPromise = fetch('/config.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : { googleClientId: '' })
      .catch(() => ({ googleClientId: '' }));
  }
  return loginConfigPromise;
};

const showLoginUser = (user) => {
  if (!loginUser) return;
  loginName.textContent = user.name || 'Conta Google';
  loginEmail.textContent = user.email || '';
  const pictureUrl = user.picture ? new URL(user.picture) : null;
  if (pictureUrl && pictureUrl.protocol === 'https:' && pictureUrl.hostname.endsWith('googleusercontent.com')) {
    loginAvatar.src = pictureUrl.href;
    loginAvatar.hidden = false;
  } else {
    loginAvatar.removeAttribute('src');
    loginAvatar.hidden = true;
  }
  loginUser.hidden = false;
  googleButton.hidden = true;
  loginSignout.hidden = false;
  setLoginStatus('Sessão iniciada com segurança.', 'success');
};

const clearLoginUser = () => {
  if (loginUser) loginUser.hidden = true;
  if (googleButton) googleButton.hidden = false;
  if (loginSignout) loginSignout.hidden = true;
  if (loginAvatar) {
    loginAvatar.removeAttribute('src');
    loginAvatar.hidden = true;
  }
};

const refreshLoginSession = async () => {
  try {
    const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return;
    const session = await response.json();
    if (session.authenticated) showLoginUser(session.user);
    else clearLoginUser();
  } catch {
    // A página segue utilizável se estiver aberta por um servidor estático sem a API de login.
  }
};

const loadGoogleServices = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleServicesPromise) {
    googleServicesPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-google-identity]');
      const script = existingScript || document.createElement('script');
      const onLoad = () => window.google?.accounts?.id ? resolve() : reject(new Error('Google Identity Services indisponível.'));
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', () => {
        script.remove();
        reject(new Error('Não foi possível carregar o login do Google.'));
      }, { once: true });
      if (!existingScript) {
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        document.head.append(script);
      }
    });
  }
  return googleServicesPromise;
};

const handleGoogleCredential = async ({ credential }) => {
  setLoginStatus('Validando sua conta…');
  try {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Não foi possível iniciar sua sessão.');
    showLoginUser(result.user);
  } catch (error) {
    setLoginStatus(error.message || 'Não foi possível iniciar sua sessão.', 'error');
  }
};

const prepareGoogleButton = async () => {
  if (!googleButton || googleButton.dataset.ready === 'true') return;
  setLoginStatus('Verificando configuração…');
  const config = await loadLoginConfig();
  if (!config.googleClientId) {
    setLoginStatus('Login Google preparado. Falta configurar o ID de cliente no servidor.', 'error');
    return;
  }
  try {
    await loadGoogleServices();
    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: handleGoogleCredential,
      ux_mode: 'popup',
      auto_select: false,
      context: 'signin'
    });
    window.google.accounts.id.renderButton(googleButton, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      locale: 'pt_BR',
      width: Math.min(310, Math.max(220, Math.floor(googleButton.getBoundingClientRect().width)))
    });
    googleButton.dataset.ready = 'true';
    setLoginStatus('');
  } catch (error) {
    googleServicesPromise = null;
    setLoginStatus(error.message || 'Não foi possível carregar o login do Google.', 'error');
  }
};

document.querySelectorAll('.login-trigger').forEach((button) => {
  button.addEventListener('click', async () => {
    closeMenu();
    if (!loginDialog.open) loginDialog.showModal();
    await refreshLoginSession();
    if (loginUser?.hidden) await prepareGoogleButton();
  });
});

document.querySelector('#login-close')?.addEventListener('click', () => loginDialog?.close());
loginDialog?.addEventListener('click', (event) => {
  if (event.target === loginDialog) loginDialog.close();
});

loginSignout?.addEventListener('click', async () => {
  setLoginStatus('Encerrando sessão…');
  try {
    const response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Protection': '1' }
    });
    if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
    clearLoginUser();
    setLoginStatus('Você saiu da sua conta.', 'success');
  } catch (error) {
    setLoginStatus(error.message || 'Não foi possível encerrar a sessão.', 'error');
  }
});

refreshLoginSession();
