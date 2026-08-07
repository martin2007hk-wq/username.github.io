/**
 * PostAIAge Chat Page — User List + Chat Integration
 * 
 * Loads registered users from Firestore, displays them in a sidebar,
 * and opens a real-time chat when a user is selected.
 * 
 * Depends on: auth.js (exports auth, db), chat.js (exports ChatManager)
 */

import { auth, db } from './auth.js?v=6';
import { ChatManager } from './chat.js?v=6';
import {
  collection,
  query,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ─────────────────────────────────────────
// ChatPage Controller
// ─────────────────────────────────────────
class ChatPage {
  constructor() {
    this.users = [];
    this.activeChat = null;
    this.currentUser = null;

    // DOM cache
    this.userListEl = document.getElementById('chatUserList');
    this.searchInput = document.getElementById('userSearch');
    this.userCountEl = document.getElementById('userCount');
    this.mainEmpty = document.getElementById('chatMainEmpty');
    this.panelPage = document.getElementById('chatPanelPage');
    this.navUserName = document.getElementById('chatNavUserName');
    this.navUserAvatar = document.getElementById('chatNavUserAvatar');

    this._init();
  }

  async _init() {
    // Wait for auth to initialize
    auth.onAuthStateChanged((user) => {
      if (!user) {
        // Not logged in — redirect to home
        window.location.href = '/';
        return;
      }
      this.currentUser = user;
      this._updateNavUser(user);
      this._loadUsers();
    });
  }

  _updateNavUser(user) {
    if (this.navUserName) {
      this.navUserName.textContent = user.displayName || user.email || 'User';
    }
    if (this.navUserAvatar && user.photoURL) {
      this.navUserAvatar.src = user.photoURL;
      this.navUserAvatar.style.display = 'block';
    }
  }

  // ── Load Registered Users ──────────────
  async _loadUsers() {
    if (!this.userListEl) return;
    this.userListEl.innerHTML = '<div class="chat-user-list-empty">載入中...</div>';

    try {
      const registrationsRef = collection(db, 'registrations');
      const q = query(registrationsRef);
      const snapshot = await getDocs(q);

      // Deduplicate by uid (keep most recent registration per user), exclude self
      const seenUids = new Set();
      const users = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.uid) return;
        if (data.uid === this.currentUser.uid) return;
        if (seenUids.has(data.uid)) return;
        seenUids.add(data.uid);

        users.push({
          uid: data.uid,
          name: data.name || 'Anonymous',
          email: data.email || null,
          avatar: data.avatar || null,
          plan: data.plan || null
        });
      });

      this.users = users;
      this._renderUserList(users);
      this._updateUserCount(users.length);

      // Bind search
      if (this.searchInput) {
        this.searchInput.addEventListener('input', () => this._onSearch());
      }

    } catch (error) {
      console.error('Failed to load users:', error);
      if (this.userListEl) {
        this.userListEl.innerHTML = '<div class="chat-user-list-empty">載入失敗，請重新整理頁面</div>';
      }
    }
  }

  // ── Render User List ───────────────────
  _renderUserList(users) {
    if (!this.userListEl) return;

    if (users.length === 0) {
      this.userListEl.innerHTML = '<div class="chat-user-list-empty">暫無其他已註冊成員</div>';
      return;
    }

    let html = '';
    users.forEach((user) => {
      const initial = (user.name || '?').charAt(0).toUpperCase();
      const avatarHtml = user.avatar
        ? `<img src="${this._escapeHtml(user.avatar)}" alt="${this._escapeHtml(user.name)}">`
        : initial;
      const planBadge = user.plan === 'B'
        ? '<span class="chat-user-item-badge plan-b">🔥 早鳥</span>'
        : (user.plan === 'A' ? '<span class="chat-user-item-badge plan-a">📩</span>' : '');

      html += `
        <div class="chat-user-item" data-uid="${this._escapeHtml(user.uid)}">
          <div class="chat-user-item-avatar">${avatarHtml}</div>
          <div class="chat-user-item-info">
            <div class="chat-user-item-name">${this._escapeHtml(user.name)}</div>
            <div class="chat-user-item-email">${this._escapeHtml(user.email || '')}</div>
          </div>
          ${planBadge}
        </div>
      `;
    });

    this.userListEl.innerHTML = html;

    // Bind click events
    this.userListEl.querySelectorAll('.chat-user-item').forEach((el) => {
      el.addEventListener('click', () => {
        const uid = el.dataset.uid;
        if (uid) this._selectUser(uid);
      });
    });
  }

  // ── Search Filter ──────────────────────
  _onSearch() {
    const term = (this.searchInput?.value || '').toLowerCase().trim();
    if (!term) {
      this._renderUserList(this.users);
      this._updateUserCount(this.users.length);
      return;
    }

    const filtered = this.users.filter((u) =>
      (u.name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
    this._renderUserList(filtered);
    this._updateUserCount(filtered.length);
  }

  _updateUserCount(count) {
    if (this.userCountEl) {
      this.userCountEl.textContent = `${count} 人`;
    }
  }

  // ── Select User → Open Chat ────────────
  _selectUser(uid) {
    const user = this.users.find((u) => u.uid === uid);
    if (!user) return;

    // Highlight active user in sidebar
    this.userListEl?.querySelectorAll('.chat-user-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.uid === uid);
    });

    // Show chat panel, hide empty state
    if (this.mainEmpty) this.mainEmpty.style.display = 'none';
    if (this.panelPage) this.panelPage.classList.remove('hidden');

    // Initialize ChatManager if not already (use page-specific panel ID)
    if (!this.activeChat) {
      this.activeChat = new ChatManager({ panelId: 'chatPanelPage', fabId: 'chatFabPage' });
      // When user clicks close, go back to user list
      this.activeChat.setOnClose(() => {
        if (this.panelPage) this.panelPage.classList.add('hidden');
        if (this.mainEmpty) this.mainEmpty.style.display = '';
        this.userListEl?.querySelectorAll('.chat-user-item').forEach((el) => {
          el.classList.remove('active');
        });
      });
    }

    // Open the chat
    this.activeChat.openChat(uid, user.name, user.avatar);
  }

  // ── Sanitization ───────────────────────
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// ─────────────────────────────────────────
// Boot
// ─────────────────────────────────────────
new ChatPage();
