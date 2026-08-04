import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBP7BlQVl4m5XUeWt6lTxYu3I1PAsbZavI",
  authDomain: "post-ai-age.firebaseapp.com",
  projectId: "post-ai-age",
  storageBucket: "post-ai-age.firebasestorage.app",
  messagingSenderId: "144030018765",
  appId: "1:144030018765:web:6b86b0f39d79a3adb44d84",
  measurementId: "G-C6MJ56Y0LR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let _isNewSignIn = false;

// Google 注冊
window.loginWithGoogle = async () => {
  try {
    _isNewSignIn = true;
    const result = await signInWithPopup(auth, provider);
    // If called from navbar/standalone, redirect to thanks
    // If there's a pending plan selection (set by loginWithGoogleForPlan), skip redirect
    if (window._earlyBirdPendingPlan) {
      // Handled by loginWithGoogleForPlan — do not redirect
      return result;
    }
    window.location.href = '/thanks';
  } catch (error) {
    _isNewSignIn = false;
    console.error("Google 注冊失敗：", error);
  }
};

/**
 * Google login for early-bird plan registration.
 * Called by earlybird.js submitGoogleRegistration().
 * Does NOT redirect to /thanks; instead records registration and closes modal.
 * @param {'A'|'B'} plan
 */
window.loginWithGoogleForPlan = async (plan) => {
  try {
    // Set flag so loginWithGoogle knows not to redirect
    window._earlyBirdPendingPlan = plan;

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Record registration via tracker
    if (typeof window.recordRegistration === 'function') {
      window.recordRegistration(plan, 'google', null);
    }

    // Close the early-bird modal
    if (typeof window.closeModal === 'function') {
      window.closeModal();
    }

    // Show success toast
    const displayName = user.displayName || user.email || '新用戶';
    if (typeof window.showToast === 'function') {
      window.showToast('🎉 登記成功！歡迎加入，' + displayName + '！我哋會喺服務上線時通知你。', 'success');
    }

    // Clear the pending plan flag
    delete window._earlyBirdPendingPlan;
  } catch (error) {
    delete window._earlyBirdPendingPlan;
    console.error("Google 注冊失敗（早鳥方案）：", error);
    if (typeof window.showToast === 'function') {
      window.showToast('Google 登入失敗，請再試一次或改用 Email 登記。', 'error');
    }
  }
};

// 登出
window.logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("登出失敗：", error);
  }
};

// 監聽注冊狀態（navbar 已無 auth UI，僅 log）
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('PostAIAge: 用户已登入', user.displayName || user.email);
  } else {
    console.log('PostAIAge: 用户未登入');
  }
});
