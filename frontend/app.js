(() => {
  const state = {
    token: null,
    username: null,
    conversationId: null,
  };

  const els = {
    authPanel: document.getElementById('authPanel'),
    chatPanel: document.getElementById('chatPanel'),
    tabLogin: document.getElementById('tabLogin'),
    tabRegister: document.getElementById('tabRegister'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginError: document.getElementById('loginError'),
    registerError: document.getElementById('registerError'),
    userLabel: document.getElementById('userLabel'),
    logoutBtn: document.getElementById('logoutBtn'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    messages: document.getElementById('messages'),
    historyList: document.getElementById('historyList'),
    conversationIdLabel: document.getElementById('conversationIdLabel'),
    refreshHistoryBtn: document.getElementById('refreshHistoryBtn'),
  };

  function showChat() {
    els.authPanel.classList.add('hidden');
    els.chatPanel.classList.remove('hidden');
    els.logoutBtn.classList.remove('hidden');
    els.userLabel.textContent = state.username || '';
  }

  function showAuth() {
    state.token = null;
    state.username = null;
    state.conversationId = null;
    els.chatPanel.classList.add('hidden');
    els.authPanel.classList.remove('hidden');
    els.logoutBtn.classList.add('hidden');
    els.userLabel.textContent = '';
    els.messages.innerHTML = '';
    els.historyList.innerHTML = '';
    els.conversationIdLabel.textContent = 'No conversation yet';
  }

  async function api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    const res = await fetch(path, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function appendBubble(role, content) {
    const div = document.createElement('div');
    div.className = `bubble ${role}`;
    div.setAttribute('data-testid', `chat_message_${role}_bubble`);
    div.textContent = content;
    els.messages.appendChild(div);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  els.tabLogin.addEventListener('click', () => {
    els.tabLogin.classList.add('active');
    els.tabRegister.classList.remove('active');
    els.loginForm.classList.remove('hidden');
    els.registerForm.classList.add('hidden');
  });

  els.tabRegister.addEventListener('click', () => {
    els.tabRegister.classList.add('active');
    els.tabLogin.classList.remove('active');
    els.registerForm.classList.remove('hidden');
    els.loginForm.classList.add('hidden');
  });

  els.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.loginError.textContent = '';
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const { res, data } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      els.loginError.textContent = data.detail || 'Login failed';
      return;
    }
    state.token = data.access_token;
    state.username = username;
    showChat();
  });

  els.registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.registerError.textContent = '';
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const { res, data } = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      els.registerError.textContent = data.detail || 'Registration failed';
      return;
    }
    const login = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!login.res.ok) {
      els.registerError.textContent = 'Account created, but login failed';
      return;
    }
    state.token = login.data.access_token;
    state.username = username;
    showChat();
  });

  els.logoutBtn.addEventListener('click', () => {
    showAuth();
  });

  els.chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = els.chatInput.value.trim();
    if (!message) return;

    appendBubble('user', message);
    els.chatInput.value = '';

    const { res, data } = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversation_id: state.conversationId,
      }),
    });

    if (res.ok) {
      state.conversationId = data.conversation_id;
      els.conversationIdLabel.textContent = `ID: ${state.conversationId}`;
      appendBubble('assistant', data.answer || '');
    }
  });

  els.refreshHistoryBtn.addEventListener('click', async () => {
    if (!state.conversationId) return;
    const { res, data } = await api(`/chat/history?conversation_id=${encodeURIComponent(state.conversationId)}`);
    if (!res.ok) return;
    els.historyList.innerHTML = '';
    for (const msg of data.messages || []) {
      const li = document.createElement('li');
      li.setAttribute('data-testid', `chat_history_item_${msg.role}`);
      li.textContent = `${msg.role}: ${msg.content.slice(0, 120)}`;
      els.historyList.appendChild(li);
    }
  });
})();
