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

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

let _isNewSignIn = false;

// ── Firestore Write ────────────────────────────────────────

/**
 * Write registration data to Firestore.
 * Returns a Promise so callers can await the write before redirecting.
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

    return addDoc(collection(db, 'registrations'), docData)
      .then(function (docRef) {
        console.log('Registration written to Firestore:', docRef.id);
        return docRef;
      })
      .catch(function (error) {
        console.error('Firestore write failed:', error);
        return null;
      });
  } catch (e) {
    console.error('Firestore writeToFirestore error:', e);
    return Promise.resolve(null);
  }
};

// Google 注冊
window.loginWithGoogle = async () => {
  try {
    _isNewSignIn = true;
    const result = await signInWithPopup(auth, provider);
    if (window._earlyBirdPendingPlan) {
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
 * @param {'A'|'B'} plan
 * @param {'modal'|'inline'} source
 */
window.loginWithGoogleForPlan = async (plan, source) => {
  try {
    window._earlyBirdPendingPlan = plan;

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (typeof window.recordRegistration === 'function') {
      window.recordRegistration(plan, 'google', null);
    }

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

// 監聽注冊狀態
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('PostAIAge: 用户已登入', user.displayName || user.email);
    // Notify chat system of auth state change
    window.dispatchEvent(new CustomEvent('postaiage:authchange', {
      detail: { user }
    }));
  } else {
    console.log('PostAIAge: 用户未登入');
    window.dispatchEvent(new CustomEvent('postaiage:authchange', {
      detail: { user: null }
    }));
  }
});

// ── Legacy global references (for non-module scripts) ──
window._firebaseAuth = auth;
window._firebaseDb = db;
