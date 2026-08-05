/**
 * PostAIAge — Early Bird Modal Logic
 * Depends on: tracker.js (loaded first), auth.js (for loginWithGoogleForPlan)
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

  /**
   * Smooth-scroll to the #early-bird section.
   */
  function scrollToEarlyBird() {
    const target = document.getElementById('early-bird');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── Modal ──────────────────────────────────────────────────

  /**
   * Record a CTA click and open the early-bird modal.
   * @param {'hero-cta'|'navbar'|'footer-cta'} source
   */
  function openEarlyBirdModal(source) {
    // Track the CTA click
    if (typeof window.trackCTAClick === 'function') {
      window.trackCTAClick(source);
    }

    if (!modal) return;

    // Reset state
    selectedPlan = null;
    planCards.forEach(function (card) {
      card.classList.remove('plan-card--selected');
    });
    if (registrationMethods) {
      registrationMethods.style.display = 'none';
    }
    // Clear modal's own email input (now has unique ID earlyBirdEmailModal)
    var modalEmailInput = document.getElementById('earlyBirdEmailModal');
    if (modalEmailInput) {
      modalEmailInput.value = '';
    }

    // Show modal
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close the modal and reset state.
   */
  function closeModal() {
    if (!modal) return;

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    selectedPlan = null;
  }

  // ── Plan Selection ─────────────────────────────────────────

  /**
   * Select plan A or B, update UI, reveal registration methods.
   * @param {'A'|'B'} plan
   */
  function selectPlan(plan) {
    selectedPlan = plan;

    planCards.forEach(function (card) {
      if (card.getAttribute('data-plan') === plan) {
        card.classList.add('plan-card--selected');
      } else {
        card.classList.remove('plan-card--selected');
      }
    });

    // Reveal registration methods
    if (registrationMethods) {
      registrationMethods.style.display = 'block';
    }
  }

  // ── Email Registration (Modal) ─────────────────────────────

  /**
   * Validate email from modal, record registration, redirect to /thanks.
   * Uses the modal's unique input ID: earlyBirdEmailModal
   */
  function submitEmailRegistration() {
    if (!selectedPlan) {
      showToast('請先選擇方案 A 或方案 B。', 'error');
      return;
    }

    // Use the modal-specific input (not the inline one)
    var modalEmailInput = document.getElementById('earlyBirdEmailModal');
    if (!modalEmailInput) {
      showToast('發生錯誤，請重新整理頁面。', 'error');
      return;
    }

    const email = modalEmailInput.value.trim();

    // Basic email validation
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showToast('請輸入有效的電郵地址。', 'error');
      return;
    }

    // Record registration (localStorage)
    if (typeof window.recordRegistration === 'function') {
      window.recordRegistration(selectedPlan, 'email', email);
    }

    // Write to Firestore and await before redirect
    const name = email.split('@')[0];
    const redirect = function () {
      window.location.href = '/thanks?plan=' + encodeURIComponent(selectedPlan) + '&method=email&name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
    };

    if (typeof window.writeToFirestore === 'function') {
      window.writeToFirestore({
        plan: selectedPlan,
        method: 'email',
        name: name,
        email: email,
        source: 'modal'
      }).then(redirect).catch(redirect);
    } else {
      redirect();
    }
  }

  // ── Google Registration ────────────────────────────────────

  /**
   * Delegate to auth.js loginWithGoogleForPlan, which handles
   * Firebase popup → recordRegistration → redirect /thanks.
   */
  function submitGoogleRegistration() {
    if (!selectedPlan) {
      showToast('請先選擇方案 A 或方案 B。', 'error');
      return;
    }

    if (typeof window.loginWithGoogleForPlan === 'function') {
      window.loginWithGoogleForPlan(selectedPlan, 'modal');
    } else {
      showToast('Google 登入功能暫時無法使用，請嘗試 Email 登記。', 'error');
    }
  }

  // ── Inline Plan Selection (bottom section) ──────────────────

  let selectedPlanInline = null;

  /**
   * Select a plan in the inline bottom section, reveal registration area.
   * @param {'A'|'B'} plan
   */
  function selectPlanInline(plan) {
    selectedPlanInline = plan;

    // Toggle card selection
    document.querySelectorAll('.plan-card-inline').forEach(function (card) {
      card.classList.remove('plan-card-inline--selected');
    });
    var planCard = document.getElementById('planCard' + plan);
    if (planCard) {
      planCard.classList.add('plan-card-inline--selected');
    }

    // Show registration area
    var regArea = document.getElementById('registrationArea');
    if (regArea) {
      regArea.style.display = 'block';
      // Scroll registration area into view smoothly
      regArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Update title based on plan
    var title = document.getElementById('registrationTitle');
    if (title) {
      title.textContent = plan === 'A' ? '登記接收上線通知' : '登記搶先預約早鳥資格';
    }

    // Track selection
    if (typeof window.trackCTAClick === 'function') {
      window.trackCTAClick(plan === 'A' ? 'plan-a-select' : 'plan-b-select');
    }
  }

  /**
   * Submit email registration from inline bottom section.
   * Redirects to /thanks on success.
   */
  function submitEmailRegistrationInline() {
    var emailInputEl = document.getElementById('earlyBirdEmail');
    var email = emailInputEl ? emailInputEl.value.trim() : '';

    if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
      showToast('請輸入有效嘅電郵地址', 'error');
      return;
    }
    if (!selectedPlanInline) {
      showToast('請先選擇一個方案', 'error');
      return;
    }

    if (typeof window.recordRegistration === 'function') {
      window.recordRegistration(selectedPlanInline, 'email', email);
    }

    // Write to Firestore and await before redirect
    const name = email.split('@')[0];
    const redirect = function () {
      window.location.href = '/thanks?plan=' + encodeURIComponent(selectedPlanInline) + '&method=email&name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
    };

    if (typeof window.writeToFirestore === 'function') {
      window.writeToFirestore({
        plan: selectedPlanInline,
        method: 'email',
        name: name,
        email: email,
        source: 'inline'
      }).then(redirect).catch(redirect);
    } else {
      redirect();
    }
  }

  /**
   * Submit Google registration from inline bottom section.
   * Delegates to auth.js loginWithGoogleForPlan, which redirects to /thanks.
   */
  function submitGoogleRegistrationInline() {
    if (!selectedPlanInline) {
      showToast('請先選擇一個方案', 'error');
      return;
    }

    if (typeof window.loginWithGoogleForPlan === 'function') {
      window.loginWithGoogleForPlan(selectedPlanInline, 'inline');
    } else {
      showToast('Google 登入暫時無法使用，請用 Email 登記', 'error');
    }
  }

  // ── Toast ──────────────────────────────────────────────────

  /**
   * Display a toast notification that auto-dismisses after 3 seconds.
   * @param {string} message
   * @param {'success'|'error'} type
   */
  function showToast(message, type) {
    if (!toastContainer) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'success');
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Auto-dismiss after 3s
    setTimeout(function () {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }

  // ── Expose to global scope ─────────────────────────────────

  window.scrollToEarlyBird = scrollToEarlyBird;
  window.openEarlyBirdModal = openEarlyBirdModal;
  window.closeModal = closeModal;
  window.selectPlan = selectPlan;
  window.submitEmailRegistration = submitEmailRegistration;
  window.submitGoogleRegistration = submitGoogleRegistration;
  window.selectPlanInline = selectPlanInline;
  window.submitEmailRegistrationInline = submitEmailRegistrationInline;
  window.submitGoogleRegistrationInline = submitGoogleRegistrationInline;
  window.showToast = showToast;

  // Also expose selectedPlan for debugging
  window._getSelectedPlan = function () { return selectedPlan; };

  // ── Close modal on overlay click & Escape key ──────────────

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });
})();
