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
    if (emailInput) {
      emailInput.value = '';
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

  // ── Email Registration ─────────────────────────────────────

  /**
   * Validate email, record registration, show toast, close modal.
   */
  function submitEmailRegistration() {
    if (!selectedPlan) {
      showToast('請先選擇方案 A 或方案 B。', 'error');
      return;
    }

    if (!emailInput) {
      showToast('發生錯誤，請重新整理頁面。', 'error');
      return;
    }

    const email = emailInput.value.trim();

    // Basic email validation
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showToast('請輸入有效的電郵地址。', 'error');
      return;
    }

    // Record registration
    if (typeof window.recordRegistration === 'function') {
      window.recordRegistration(selectedPlan, 'email', email);
    }

    showToast('🎉 登記成功！我哋會喺服務上線時通知你。', 'success');
    closeModal();
  }

  // ── Google Registration ────────────────────────────────────

  /**
   * Delegate to auth.js loginWithGoogleForPlan, which handles
   * Firebase popup → recordRegistration → closeModal → toast.
   */
  function submitGoogleRegistration() {
    if (!selectedPlan) {
      showToast('請先選擇方案 A 或方案 B。', 'error');
      return;
    }

    if (typeof window.loginWithGoogleForPlan === 'function') {
      window.loginWithGoogleForPlan(selectedPlan);
    } else {
      showToast('Google 登入功能暫時無法使用，請嘗試 Email 登記。', 'error');
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
