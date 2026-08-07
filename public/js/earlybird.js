/**
 * PostAIAge — Early Bird + Inline Registration Logic
 * Depends on: tracker.js (loaded first), auth.js (v7)
 * Vanilla JS, no dependencies.
 */

(function () {
  'use strict';

  let selectedPlan = null;

  // ── DOM references ─────────────────────────────────────────

  const modal = document.getElementById('earlyBirdModal');
  const planCards = document.querySelectorAll('.plan-card');
  const registrationMethods = document.getElementById('registrationMethods');
  const emailInput = document.getElementById('earlyBirdEmail');
  const toastContainer = document.getElementById('toastContainer');

  // ── Scroll ─────────────────────────────────────────────────

  function scrollToEarlyBird() {
    const target = document.getElementById('early-bird');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── Modal ──────────────────────────────────────────────────

  function openEarlyBirdModal(source) {
    if (typeof window.trackCTAClick === 'function') {
      window.trackCTAClick(source);
    }
    if (!modal) return;

    selectedPlan = null;
    planCards.forEach(function (card) {
      card.classList.remove('plan-card--selected');
    });
    if (registrationMethods) {
      registrationMethods.style.display = 'none';
    }
    var modalEmailInput = document.getElementById('earlyBirdEmailModal');
    if (modalEmailInput) modalEmailInput.value = '';
    var modalPasswordInput = document.getElementById('earlyBirdPasswordModal');
    if (modalPasswordInput) modalPasswordInput.value = '';

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    selectedPlan = null;
    var modalPasswordInput = document.getElementById('earlyBirdPasswordModal');
    if (modalPasswordInput) modalPasswordInput.value = '';
  }

  // ── Plan Selection (Modal) ─────────────────────────────────

  function selectPlan(plan) {
    selectedPlan = plan;
    planCards.forEach(function (card) {
      if (card.getAttribute('data-plan') === plan) {
        card.classList.add('plan-card--selected');
      } else {
        card.classList.remove('plan-card--selected');
      }
    });
    if (registrationMethods) {
      registrationMethods.style.display = 'block';
    }
  }

  // ── Email Registration (Modal) ─────────────────────────────

  async function submitEmailRegistration() {
    if (!selectedPlan) {
      showToast('請先選擇方案 A 或方案 B。', 'error');
      return;
    }
    var modalEmailInput = document.getElementById('earlyBirdEmailModal');
    var modalPasswordInput = document.getElementById('earlyBirdPasswordModal');
    if (!modalEmailInput || !modalPasswordInput) {
      showToast('發生錯誤，請重新整理頁面。', 'error');
      return;
    }
    const email = modalEmailInput.value.trim();
    const password = modalPasswordInput.value;
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showToast('請輸入有效的電郵地址。', 'error');
      return;
    }
    if (!password || password.length < 6) {
      showToast('密碼最少需要6位字符。', 'error');
      return;
    }
    const name = email.split('@')[0];

    // Use new registerWithEmail (v7 auth.js)
    if (typeof window.registerWithEmail === 'function') {
      try {
        const { user } = await window.registerWithEmail(email, password, selectedPlan, {
          status: null, emailVisible: false, name: name
        });
        if (typeof window.recordRegistration === 'function') {
          window.recordRegistration(selectedPlan, 'email', email);
        }
        window.location.href = '/thanks?plan=' + encodeURIComponent(selectedPlan)
          + '&method=email&name=' + encodeURIComponent(name)
          + '&email=' + encodeURIComponent(email)
          + '&uid=' + encodeURIComponent(user.uid || '');
        return;
      } catch (error) {
        console.error('Email registration failed:', error);
        if (error.code === 'auth/weak-password') showToast('密碼太弱，請設定一個更強嘅密碼。', 'error');
        else if (error.code === 'auth/invalid-email') showToast('電郵地址格式有誤，請檢查。', 'error');
        else if (error.code === 'auth/too-many-requests') showToast('嘗試次數過多，請稍後再試。', 'error');
        else showToast('登記失敗，請稍後再試或改用 Google 登入。', 'error');
        return;
      }
    }

    // Fallback
    if (typeof window.recordRegistration === 'function') window.recordRegistration(selectedPlan, 'email', email);
    if (typeof window.writeToFirestore === 'function') {
      await window.writeToFirestore({ plan: selectedPlan, method: 'email', name: name, email: email, source: 'modal' });
    }
    window.location.href = '/thanks?plan=' + encodeURIComponent(selectedPlan)
      + '&method=email&name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
  }

  // ── Google Registration (Modal) ────────────────────────────

  function submitGoogleRegistration() {
    if (!selectedPlan) {
      showToast('請先選擇方案 A 或方案 B。', 'error');
      return;
    }
    if (typeof window.registerWithGoogle === 'function') {
      window.registerWithGoogle(selectedPlan, { source: 'modal' }).then(() => {
        window.location.href = '/thanks?plan=' + encodeURIComponent(selectedPlan) + '&method=google';
      }).catch(() => {
        showToast('Google 登入失敗，請再試一次。', 'error');
      });
    } else {
      showToast('Google 登入功能暫時無法使用，請嘗試 Email 登記。', 'error');
    }
  }

  // ── Inline Plan Selection (bottom section) ──────────────────
  // After selecting a plan, the user is guided to /register?plan=A|B

  let selectedPlanInline = null;

  function selectPlanInline(plan) {
    selectedPlanInline = plan;

    document.querySelectorAll('.plan-card-inline').forEach(function (card) {
      card.classList.remove('plan-card-inline--selected');
    });
    var planCard = document.getElementById('planCard' + plan);
    if (planCard) planCard.classList.add('plan-card-inline--selected');

    var regArea = document.getElementById('registrationArea');
    if (regArea) {
      regArea.style.display = 'block';
      regArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    var title = document.getElementById('registrationTitle');
    if (title) {
      title.textContent = plan === 'A' ? '方案 A：免費訂閱通知' : '方案 B：限量早鳥';
    }

    // Update the "前往註冊" button href with plan param
    var btn = document.getElementById('btnGoRegister');
    if (btn) {
      btn.href = '/register?plan=' + plan;
    }

    if (typeof window.trackCTAClick === 'function') {
      window.trackCTAClick(plan === 'A' ? 'plan-a-select' : 'plan-b-select');
    }
  }

  // Old inline submit functions — now just redirect to /register
  window.submitEmailRegistrationInline = function () {
    if (selectedPlanInline) {
      window.location.href = '/register?plan=' + selectedPlanInline;
    } else {
      showToast('請先選擇一個方案', 'error');
    }
  };
  window.submitGoogleRegistrationInline = function () {
    if (selectedPlanInline) {
      window.location.href = '/register?plan=' + selectedPlanInline;
    } else {
      showToast('請先選擇一個方案', 'error');
    }
  };

  // ── Toast ──────────────────────────────────────────────────

  function showToast(message, type) {
    if (!toastContainer) return;
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'success');
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 3000);
  }

  // ── Expose to global scope ─────────────────────────────────

  window.scrollToEarlyBird = scrollToEarlyBird;
  window.openEarlyBirdModal = openEarlyBirdModal;
  window.closeModal = closeModal;
  window.selectPlan = selectPlan;
  window.submitEmailRegistration = submitEmailRegistration;
  window.submitGoogleRegistration = submitGoogleRegistration;
  window.selectPlanInline = selectPlanInline;
  window.showToast = showToast;

  window._getSelectedPlan = function () { return selectedPlan; };

  // ── Close modal on overlay click & Escape ──────────────────

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) closeModal();
  });
})();
