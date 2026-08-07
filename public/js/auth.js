import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const googleProvider = new GoogleAuthProvider();

// Cached user profile (from users/{uid})
let _cachedProfile = null;

// ── User Profile ──────────────────────────────────────────

/**
 * Save/update user profile in Firestore users/{uid}.
 * @param {object} data - { name, email, avatar, plan, status, emailVisible }
 */
window.saveUserProfile = async function (data) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    name: data.name || user.displayName || (user.email ? user.email.split('@')[0] : 'Anonymous'),
    email: data.email || user.email || null,
    avatar: data.avatar || user.photoURL || null,
    plan: data.plan || null,
    status: data.status || null,
    emailVisible: data.emailVisible === true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });

  // Update cache
  _cachedProfile = data;
  console.log('PostAIAge: Profile saved', data);
  return true;
};

/**
 * Load user profile from Firestore users/{uid}.
 * Falls back to auth user info if no profile exists.
 */
window.getUserProfile = async function () {
  const user = auth.currentUser;
  if (!user) return null;

  if (_cachedProfile) return _cachedProfile;

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      _cachedProfile = snap.data();
      return _cachedProfile;
    }
  } catch (e) {
    console.warn('PostAIAge: Failed to load profile', e);
  }

  // Fallback
  return {
    name: user.displayName || (user.email ? user.email.split('@')[0] : 'Anonymous'),
    email: user.email || null,
    avatar: user.photoURL || null,
    plan: null,
    status: null,
    emailVisible: false
  };
};

// ── Google Login ──────────────────────────────────────────

/**
 * Google sign-in (general purpose, no redirect).
 * @returns {Promise<object>} Firebase user
 */
window.loginWithGoogle = async function () {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('PostAIAge: Google 登入成功', result.user.email);
    return result.user;
  } catch (error) {
    console.error('PostAIAge: Google 登入失敗', error);
    throw error;
  }
};

/**
 * Google sign-in + save profile + write to registrations (for registration flow).
 * @param {'A'|'B'} plan
 * @param {object} extra - { status, emailVisible }
 */
window.registerWithGoogle = async function (plan, extra = {}) {
  try {
    const user = await window.loginWithGoogle();

    await window.saveUserProfile({
      name: user.displayName || 'Early Bird',
      email: user.email,
      avatar: user.photoURL,
      plan: plan,
      status: extra.status || null,
      emailVisible: extra.emailVisible === true
    });

    // Also write to registrations for backward compat
    await window.writeToFirestore({
      plan: plan,
      method: 'google',
      name: user.displayName || 'Early Bird',
      email: user.email,
      avatar: user.photoURL,
      uid: user.uid,
      source: 'register',
      status: extra.status || null,
      emailVisible: extra.emailVisible === true
    });

    return user;
  } catch (error) {
    console.error('PostAIAge: Google 註冊失敗', error);
    throw error;
  }
};

// ── Email/Password ────────────────────────────────────────

/**
 * Sign in with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} Firebase user
 */
window.loginWithEmail = async function (email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('PostAIAge: Email 登入成功', result.user.email);
    return result.user;
  } catch (error) {
    console.error('PostAIAge: Email 登入失敗', error);
    throw error;
  }
};

/**
 * Sign up with email + password (creates Firebase Auth account).
 * Falls back to sign-in if email already exists.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object, isNew: boolean}>}
 */
window.signUpWithEmail = async function (email, password) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log('PostAIAge: Email 註冊成功', result.user.email);
    return { user: result.user, isNew: true };
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      const signInResult = await signInWithEmailAndPassword(auth, email, password);
      console.log('PostAIAge: Email 登入（已有帳戶）', signInResult.user.email);
      return { user: signInResult.user, isNew: false };
    }
    console.error('PostAIAge: Email 註冊失敗', error);
    throw error;
  }
};

/**
 * Full email registration: create auth + save profile + write registrations.
 * @param {string} email
 * @param {string} password
 * @param {'A'|'B'} plan
 * @param {object} extra - { status, emailVisible, name }
 */
window.registerWithEmail = async function (email, password, plan, extra = {}) {
  const { user, isNew } = await window.signUpWithEmail(email, password);
  const name = extra.name || email.split('@')[0];

  await window.saveUserProfile({
    name: name,
    email: email,
    avatar: null,
    plan: plan,
    status: extra.status || null,
    emailVisible: extra.emailVisible === true
  });

  await window.writeToFirestore({
    plan: plan,
    method: 'email',
    name: name,
    email: email,
    uid: user.uid,
    source: 'register',
    status: extra.status || null,
    emailVisible: extra.emailVisible === true
  });

  return { user, isNew };
};

// ── Logout ────────────────────────────────────────────────

window.logout = async function () {
  try {
    _cachedProfile = null;
    await signOut(auth);
    console.log('PostAIAge: 已登出');
  } catch (error) {
    console.error('PostAIAge: 登出失敗', error);
  }
};

// ── Firestore Write (Legacy) ──────────────────────────────

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
      status: data.status || null,
      emailVisible: data.emailVisible === true,
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

// ── Auth State Listener ───────────────────────────────────

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('PostAIAge: 用户已登入', user.displayName || user.email);
    // Load profile and dispatch event
    window.getUserProfile().then((profile) => {
      window.dispatchEvent(new CustomEvent('postaiage:authchange', {
        detail: {
          user: user,
          profile: profile
        }
      }));
    });
  } else {
    console.log('PostAIAge: 用户未登入');
    _cachedProfile = null;
    window.dispatchEvent(new CustomEvent('postaiage:authchange', {
      detail: {
        user: null,
        profile: null
      }
    }));
  }
});

// ── Legacy global references ──────────────────────────────
window._firebaseAuth = auth;
window._firebaseDb = db;
