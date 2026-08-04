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

// Google 注冊
window.loginWithGoogle = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Google 注冊失敗：", error);
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

// 監聽注冊狀態，切換 UI
onAuthStateChanged(auth, (user) => {
  const loginBtn = document.getElementById('auth-login-btn');
  const userInfo = document.getElementById('auth-user-info');
  const avatar   = document.getElementById('auth-avatar');
  const nameSpan = document.getElementById('auth-name');

  if (user) {
    // 已注冊：隱藏注冊掣，顯示用户頭像 + 名稱 + 登出
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (avatar) {
      avatar.src = user.photoURL || '';
      avatar.alt = user.displayName || '';
    }
    if (nameSpan) nameSpan.textContent = user.displayName || user.email;
  } else {
    // 未注冊：顯示注冊掣，隱藏用户資訊
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userInfo) userInfo.style.display = 'none';
  }
});
