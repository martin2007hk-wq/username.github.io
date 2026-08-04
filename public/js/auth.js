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
    await signInWithPopup(auth, provider);
    window.location.href = '/thanks';
  } catch (error) {
    _isNewSignIn = false;
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

// 監聽注冊狀態（navbar 已無 auth UI，僅 log）
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('PostAIAge: 用户已登入', user.displayName || user.email);
  } else {
    console.log('PostAIAge: 用户未登入');
  }
});
