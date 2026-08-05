import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const db = getFirestore(app);

let _isNewSignIn = false;

// ── Firestore Write ────────────────────────────────────────

/**
 * Write registration data to Firestore.
 * Returns a Promise so callers can await the write before redirecting.
 * Fails silently — never blocks redirect to /thanks.
 * @param {{ plan: string, method: string, name: string, email: string|null, avatar: string|null, uid: string|null, source: string }} data
 * @returns {Promise}
 */
window.writeToFirestore = function (data) {
  try {
    const docData = {
      plan: data.plan,
      method: data.method,
      name: data.name,
      email: data.email || null,
      avatar: data.avatar || null,
      uid: data.uid || null,
      source: data.source || 'inline',
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString()
    };

    // Return the promise so callers can await the write before redirecting
    return addDoc(collection(db, 'registrations'), docData)
      .then(function (docRef) {
        console.log('Registration written to Firestore:', docRef.id);
        return docRef;
      })
      .catch(function (error) {
        console.error('Firestore write failed:', error);
        // Silent failure — don't block redirect
        return null;
      });
  } catch (e) {
    console.error('Firestore writeToFirestore error:', e);
    // Silent failure
    return Promise.resolve(null);
  }
};

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
 * Called by earlybird.js submitGoogleRegistration() / submitGoogleRegistrationInline().
 * Awaits Firestore write before redirecting to /thanks with plan, name, avatar and uid params.
 * @param {'A'|'B'} plan
 * @param {'modal'|'inline'} source - which UI triggered the registration (default: 'inline')
 */
window.loginWithGoogleForPlan = async (plan, source) => {
  try {
    // Set flag so loginWithGoogle knows not to redirect
    window._earlyBirdPendingPlan = plan;

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Record registration via tracker (localStorage)
    if (typeof window.recordRegistration === 'function') {
      window.recordRegistration(plan, 'google', null);
    }

    // Write to Firestore and AWAIT completion before redirect
    await window.writeToFirestore({
      plan: plan,
      method: 'google',
      name: user.displayName || 'Early Bird',
      email: user.email || null,
      avatar: user.photoURL || null,
      uid: user.uid,
      source: source || 'inline'
    });

    const params = new URLSearchParams();
    params.set('plan', plan);
    params.set('method', 'google');
    params.set('name', user.displayName || 'Early Bird');
    params.set('avatar', user.photoURL || '');
    params.set('uid', user.uid);
    window.location.href = '/thanks?' + params.toString();

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
