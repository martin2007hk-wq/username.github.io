/**
 * PostAIAge Register Page Logic
 */
import { auth } from './auth.js?v=8';

let selectedPlan = null;
let selectedStatus = null;
let emailVisible = false;

// ── Read plan from URL parameter ────────────────────────

function initPlanFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const planParam = params.get('plan');
  if (planParam === 'A' || planParam === 'B') {
    // Keep the confirmation step visible: the visitor selected a plan on the
    // landing page and must confirm it once more before entering their data.
    document.querySelectorAll('.reg-plan-card').forEach((el) => {
      el.classList.toggle('selected', el.dataset.plan === planParam);
    });
  }
}

// ── Step 1: Plan Selection ─────────────────────────────

window.selectRegPlan = function (plan) {
  selectedPlan = plan;

  document.querySelectorAll('.reg-plan-card').forEach((el) => {
    el.classList.toggle('selected', el.dataset.plan === plan);
  });

  document.getElementById('selectedPlanLabel').textContent = plan === 'A' ? '個人交流' : '共建交流';

  // Show step 2
  document.getElementById('stepPlan').classList.add('hidden');
  document.getElementById('stepProfile').classList.remove('hidden');

  // Update URL without reload
  const url = new URL(window.location);
  url.searchParams.set('plan', plan);
  window.history.replaceState({}, '', url);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlanFromUrl, { once: true });
} else {
  initPlanFromUrl();
}

// ── Step 2: Status ────────────────────────────────────

window.selectStatus = function (status) {
  selectedStatus = status;
};

// ── Step 2: Email Visibility ──────────────────────────

window.selectEmailVisible = function (visible) {
  emailVisible = visible;
};

// ── Submit: Email ─────────────────────────────────────

window.submitEmailReg = async function () {
  const nameEl = document.getElementById('regName');
  const emailEl = document.getElementById('regEmail');
  const passwordEl = document.getElementById('regPassword');
  const statusEl = document.getElementById('regStatus');
  const btn = document.getElementById('btnEmailReg');

  const name = nameEl?.value.trim() || '';
  const email = emailEl?.value.trim();
  const password = passwordEl?.value;

  // Validation
  if (!email || email.indexOf('@') === -1) {
    showToast('請輸入一個收得到信的電郵地址', 'error');
    return;
  }
  if (!password || password.length < 6) {
    showToast('密碼至少需要 6 個字元', 'error');
    return;
  }
  if (!selectedPlan) {
    showToast('請先選擇你的交流方式', 'error');
    return;
  }
  if (!selectedStatus) {
    showToast('請選擇你最想交流的主題', 'error');
    return;
  }

  // Disable button
  btn.disabled = true;
  btn.textContent = '正在建立你的帳戶...';
  statusEl.classList.add('hidden');

  try {
    await window.registerWithEmail(email, password, selectedPlan, {
      name: name || email.split('@')[0],
      status: selectedStatus,
      emailVisible: emailVisible
    });

    statusEl.className = 'reg-status success';
    statusEl.textContent = '✅ 帳戶已建立，正在帶你去下一步...';
    statusEl.classList.remove('hidden');

    // /thanks reads the saved profile itself; keep personal data out of the URL.
    setTimeout(() => {
      window.location.href = '/thanks';
    }, 1000);

  } catch (error) {
    console.error('Registration failed:', error);
    statusEl.className = 'reg-status error';
    if (error.code === 'auth/weak-password') {
      statusEl.textContent = '密碼太容易猜，請換一個更安全的組合。';
    } else if (error.code === 'auth/invalid-email') {
      statusEl.textContent = '這個電郵地址格式不正確，請再檢查一次。';
    } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      // signUpWithEmail falls back to signing in when the email already exists.
      statusEl.textContent = '這個電郵已經有帳戶，但密碼不正確。請回到首頁登入。';
    } else if (error.code === 'auth/too-many-requests') {
      statusEl.textContent = '嘗試次數太多，請休息一會再試。';
    } else {
      statusEl.textContent = '未能完成登記，請稍後再試。';
    }
    statusEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '建立帳戶，繼續 →';
  }
};

// ── Submit: Google ────────────────────────────────────

window.submitGoogleReg = async function () {
  if (!selectedPlan) {
    showToast('請先選擇你的交流方式', 'error');
    return;
  }
  if (!selectedStatus) {
    showToast('請選擇你最想交流的主題', 'error');
    return;
  }

  const nameEl = document.getElementById('regName');
  const name = nameEl?.value.trim() || '';

  const btn = document.getElementById('btnGoogleReg');
  const statusEl = document.getElementById('regStatus');
  btn.disabled = true;
  btn.textContent = '正在連接 Google...';
  statusEl.classList.add('hidden');

  try {
    await window.registerWithGoogle(selectedPlan, {
      status: selectedStatus,
      emailVisible: emailVisible
    });

    // If the user has a custom name, save it to profile after registration
    if (name && name.length > 0) {
      await window.saveUserProfile({
        name: name,
        status: selectedStatus,
        emailVisible: emailVisible,
        plan: selectedPlan
      });
    }

    window.location.href = '/thanks';

  } catch (error) {
    console.error('Google registration failed:', error);
    showToast('Google 暫時未能完成登入，請再試一次', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '用 Google 帳戶繼續';
  }
};

// ── Auth State ────────────────────────────────────────

// Only the sign-in state restored on page load decides whether to leave.
// Sign-ins that happen during registration are redirected by the submit
// handlers once the profile is saved; redirecting here as well would race
// those writes.
let initialAuthHandled = false;
auth.onAuthStateChanged(async (user) => {
  if (initialAuthHandled) return;
  initialAuthHandled = true;
  if (!user) return;

  // Members who already have a profile belong in the community. Signed-in
  // users without one (e.g. Google sign-in from the login modal) may stay
  // and finish registering.
  const profile = await window.getUserProfile().catch(() => null);
  if (profile?.plan) {
    window.location.replace('/chat');
  }
});

// ── Toast ──────────────────────────────────────────────

function showToast(msg, type) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast--' + (type || 'success');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
