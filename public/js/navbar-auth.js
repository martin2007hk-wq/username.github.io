/**
 * PostAIAge Navbar Auth UI
 * 
 * Manages the navbar CTA area: shows 登入/註冊 when logged out,
 * avatar + plan + logout when logged in.
 * 
 * Listens for 'postaiage:authchange' event from auth.js (v7)
 * with { user, profile } detail.
 */

let _user = null;
let _profile = null;

const navCta = document.getElementById('navCta');

// ── Listen for auth changes ─────────────────────────────

window.addEventListener('postaiage:authchange', (e) => {
  _user = e.detail.user;
  _profile = e.detail.profile;
  render();
});

// ── Render Navbar CTA ───────────────────────────────────

function render() {
  if (!navCta) return;

  if (_user) {
    // ── Logged In: avatar + plan + logout ──
    const avatar = _profile?.avatar || _user.photoURL;
    const name = _profile?.name || _user.displayName || (_user.email ? _user.email.split('@')[0] : 'User');
    const planLabel = _profile?.plan === 'B' ? '🔥 早鳥' : (_profile?.plan === 'A' ? '📩 訂閱' : '');

    navCta.innerHTML = `
      <div class="navbar-user">
        ${avatar
          ? `<img class="nav-avatar" src="${escapeHtml(avatar)}" alt="">`
          : `<span class="nav-avatar-placeholder">${name.charAt(0).toUpperCase()}</span>`}
        <span class="nav-user-info">
          <span class="nav-user-name">${escapeHtml(name)}</span>
          ${planLabel ? `<span class="nav-user-plan">${planLabel}</span>` : ''}
        </span>
        <button class="nav-logout-btn" id="btnLogout">登出</button>
      </div>
    `;

    document.getElementById('btnLogout')?.addEventListener('click', () => {
      if (typeof window.logout === 'function') window.logout();
    });
  } else {
    // ── Logged Out: 登入 + 註冊 ──
    navCta.innerHTML = `
      <button class="btn btn-outline btn-sm" id="btnLogin">登入</button>
      <button class="btn btn-primary btn-sm" id="btnRegister">註冊</button>
    `;

    document.getElementById('btnLogin')?.addEventListener('click', openLoginModal);
    document.getElementById('btnRegister')?.addEventListener('click', () => {
      window.location.href = '/register';
    });
  }
}

// ── Login Modal ─────────────────────────────────────────

function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  // Focus email field
  setTimeout(() => document.getElementById('loginEmail')?.focus(), 100);
}

window.closeLoginModal = function () {
  const modal = document.getElementById('loginModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  // Clear form
  const emailEl = document.getElementById('loginEmail');
  const passwordEl = document.getElementById('loginPassword');
  const errorEl = document.getElementById('loginError');
  if (emailEl) emailEl.value = '';
  if (passwordEl) passwordEl.value = '';
  if (errorEl) errorEl.classList.add('hidden');
};

window.submitLoginEmail = async function () {
  const emailEl = document.getElementById('loginEmail');
  const passwordEl = document.getElementById('loginPassword');
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('btnLoginEmail');

  const email = emailEl?.value.trim();
  const password = passwordEl?.value;

  if (!email || email.indexOf('@') === -1) {
    showLoginError('請輸入有效嘅電郵地址');
    return;
  }
  if (!password || password.length < 6) {
    showLoginError('密碼最少需要6位字符');
    return;
  }

  btn.disabled = true;
  btn.textContent = '登入中...';
  if (errorEl) errorEl.classList.add('hidden');

  try {
    await window.loginWithEmail(email, password);
    window.closeLoginModal();
  } catch (err) {
    console.error('Login failed:', err);
    let msg = '登入失敗，請檢查電郵同密碼';
    if (err.code === 'auth/invalid-credential') msg = '電郵或密碼錯誤';
    else if (err.code === 'auth/user-not-found') msg = '呢個電郵尚未註冊';
    else if (err.code === 'auth/wrong-password') msg = '密碼錯誤';
    else if (err.code === 'auth/too-many-requests') msg = '嘗試次數過多，請稍後再試';
    showLoginError(msg);
  } finally {
    btn.disabled = false;
    btn.textContent = '登入 →';
  }
};

window.submitLoginGoogle = async function () {
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('btnLoginGoogle');

  btn.disabled = true;
  btn.textContent = '登入中...';
  if (errorEl) errorEl.classList.add('hidden');

  try {
    await window.loginWithGoogle();
    window.closeLoginModal();
  } catch (err) {
    console.error('Google login failed:', err);
    if (err.code !== 'auth/popup-closed-by-user') {
      showLoginError('Google 登入失敗，請再試一次');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '以 Google 帳戶登入';
  }
};

function showLoginError(msg) {
  const errorEl = document.getElementById('loginError');
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

// ── Utils ───────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Init ────────────────────────────────────────────────

// Try to render immediately with cached auth state (before authchange fires)
if (window._firebaseAuth?.currentUser) {
  _user = window._firebaseAuth.currentUser;
  if (typeof window.getUserProfile === 'function') {
    window.getUserProfile().then(p => {
      _profile = p;
      render();
    });
  } else {
    render();
  }
} else {
  render();
}

// Close login modal on overlay click & Escape key
document.addEventListener('click', (e) => {
  const modal = document.getElementById('loginModal');
  if (modal && e.target === modal) window.closeLoginModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('loginModal');
    if (modal?.classList.contains('active')) window.closeLoginModal();
  }
});
