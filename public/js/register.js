/**
 * PostAIAge Register Page Logic
 */
import { auth } from './auth.js?v=7';

let selectedPlan = null;
let selectedStatus = null;
let emailVisible = false;

// ── Read plan from URL parameter ────────────────────────

(function initPlanFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const planParam = params.get('plan');
  if (planParam === 'A' || planParam === 'B') {
    // Auto-select the plan and skip step 1
    selectRegPlan(planParam);
  }
})();

// ── Step 1: Plan Selection ─────────────────────────────

window.selectRegPlan = function (plan) {
  selectedPlan = plan;

  document.querySelectorAll('.reg-plan-card').forEach((el) => {
    el.classList.toggle('selected', el.dataset.plan === plan);
  });

  document.getElementById('selectedPlanLabel').textContent = plan === 'A' ? '方案 A：免費訂閱' : '方案 B：限量早鳥';

  // Show step 2
  document.getElementById('stepPlan').classList.add('hidden');
  document.getElementById('stepProfile').classList.remove('hidden');

  // Update URL without reload
  const url = new URL(window.location);
  url.searchParams.set('plan', plan);
  window.history.replaceState({}, '', url);
};

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
    showToast('請輸入有效嘅電郵地址', 'error');
    return;
  }
  if (!password || password.length < 6) {
    showToast('密碼最少需要6位字符', 'error');
    return;
  }
  if (!selectedPlan) {
    showToast('請選擇方案', 'error');
    return;
  }
  if (!selectedStatus) {
    showToast('請選擇你目前嘅身份', 'error');
    return;
  }

  // Disable button
  btn.disabled = true;
  btn.textContent = '登記中...';
  statusEl.classList.add('hidden');

  try {
    await window.registerWithEmail(email, password, selectedPlan, {
      name: name || email.split('@')[0],
      status: selectedStatus,
      emailVisible: emailVisible
    });

    statusEl.className = 'reg-status success';
    statusEl.textContent = '✅ 登記成功！即將跳轉...';
    statusEl.classList.remove('hidden');

    setTimeout(() => {
      window.location.href = '/thanks?plan=' + encodeURIComponent(selectedPlan)
        + '&method=email&name=' + encodeURIComponent(name)
        + '&status=' + encodeURIComponent(selectedStatus);
    }, 1000);

  } catch (error) {
    console.error('Registration failed:', error);
    statusEl.className = 'reg-status error';
    if (error.code === 'auth/weak-password') {
      statusEl.textContent = '密碼太弱，請設定一個更強嘅密碼。';
    } else if (error.code === 'auth/email-already-in-use') {
      statusEl.textContent = '呢個電郵已經註冊過，請改用登入。';
    } else if (error.code === 'auth/too-many-requests') {
      statusEl.textContent = '嘗試次數過多，請稍後再試。';
    } else {
      statusEl.textContent = '登記失敗：' + (error.message || '請再試一次');
    }
    statusEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '確認登記 →';
  }
};

// ── Submit: Google ────────────────────────────────────

window.submitGoogleReg = async function () {
  if (!selectedPlan) {
    showToast('請選擇方案', 'error');
    return;
  }
  if (!selectedStatus) {
    showToast('請選擇你目前嘅身份', 'error');
    return;
  }

  const nameEl = document.getElementById('regName');
  const name = nameEl?.value.trim() || '';

  const btn = document.getElementById('btnGoogleReg');
  const statusEl = document.getElementById('regStatus');
  btn.disabled = true;
  btn.textContent = '登入中...';
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

    window.location.href = '/thanks?plan=' + encodeURIComponent(selectedPlan)
      + '&method=google&name=' + encodeURIComponent(name)
      + '&status=' + encodeURIComponent(selectedStatus);

  } catch (error) {
    console.error('Google registration failed:', error);
    showToast('Google 登入失敗，請再試一次', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '以 Google 帳戶繼續';
  }
};

// ── Auth State ────────────────────────────────────────

auth.onAuthStateChanged((user) => {
  if (user) {
    window.getUserProfile().then((profile) => {
      const plan = profile?.plan || 'A';
      window.location.href = '/thanks?plan=' + encodeURIComponent(plan);
    }).catch(() => {
      window.location.href = '/thanks';
    });
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
