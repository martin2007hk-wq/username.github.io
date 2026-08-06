/**
 * PostAIAge Chat — Core Module
 * 
 * Architecture:
 * - Firebase Firestore onSnapshot for real-time messaging
 * - Cost-optimized: limit(50) + cursor pagination + denormalized previews
 * - ChatManager class handles lifecycle (open/close/unsubscribe)
 * - Client-side validation + rate limiting (defense in depth)
 * 
 * Depends on: auth.js (exports { auth, db, app })
 */

import { auth, db } from './auth.js';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  writeBatch,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const PAGE_SIZE = 50;
const MAX_CHARS = 5000;
const MIN_CHARS = 1;
const COOLDOWN_MS = 2000; // 2-second client-side cooldown

// ─────────────────────────────────────────
// ChatManager Class
// ─────────────────────────────────────────
class ChatManager {
  constructor() {
    this.unsubscribers = new Map();
    this.currentChatId = null;
    this.currentOtherUid = null;
    this.currentOtherName = 'Chat';
    this.currentOtherAvatar = null;
    this.lastSendTime = 0;
    this.oldestVisibleTimestamp = null;
    this.hasMoreMessages = true;
    this.isLoadingMore = false;

    // UI element cache (populated on init)
    this.panel = null;
    this.fab = null;
    this.messagesEl = null;
    this.inputEl = null;
    this.sendBtn = null;
    this.closeBtn = null;
    this.headerName = null;
    this.headerAvatar = null;
    this.headerStatus = null;

    // Auth state
    this.user = auth.currentUser;

    // Bind methods
    this._onAuthChange = this._onAuthChange.bind(this);
    this._onSendClick = this._onSendClick.bind(this);
    this._onInputKey = this._onInputKey.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onFabClick = this._onFabClick.bind(this);
    this._onCloseClick = this._onCloseClick.bind(this);

    this._init();
  }

  // ── Initialization ────────────────────
  _init() {
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._setup());
    } else {
      this._setup();
    }
  }

  _setup() {
    // Cache DOM elements
    this.panel = document.getElementById('chatPanel');
    this.fab = document.getElementById('chatFab');
    this.messagesEl = document.getElementById('chatMessages');
    this.inputEl = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('chatSendBtn');
    this.closeBtn = document.getElementById('chatCloseBtn');
    this.headerName = document.getElementById('chatHeaderName');
    this.headerAvatar = document.getElementById('chatHeaderAvatar');
    this.headerStatus = document.getElementById('chatHeaderStatus');
    this.loadMoreEl = document.getElementById('chatLoadMore');

    // Bind events
    if (this.fab) this.fab.addEventListener('click', this._onFabClick);
    if (this.closeBtn) this.closeBtn.addEventListener('click', this._onCloseClick);
    if (this.sendBtn) this.sendBtn.addEventListener('click', this._onSendClick);
    if (this.inputEl) {
      this.inputEl.addEventListener('keydown', this._onInputKey);
      this.inputEl.addEventListener('input', () => this._autoResizeInput());
    }
    if (this.messagesEl) {
      this.messagesEl.addEventListener('scroll', this._onScroll);
    }

    // Listen for auth changes from auth.js
    window.addEventListener('postaiage:authchange', this._onAuthChange);
  }

  // ── Auth ──────────────────────────────
  _onAuthChange(e) {
    this.user = e.detail.user;
    if (!this.user) {
      this.closeChat();
    }
  }

  _ensureAuth() {
    if (!this.user) {
      // Trigger Google sign-in via auth.js
      if (typeof window.loginWithGoogle === 'function') {
        window.loginWithGoogle();
      }
      return false;
    }
    return true;
  }

  // ── Chat Lifecycle ────────────────────
  /**
   * Open a chat with another user.
   * @param {string} otherUid - The other user's UID
   * @param {string} otherName - Display name
   * @param {string|null} otherAvatar - Avatar URL
   */
  openChat(otherUid, otherName = 'User', otherAvatar = null) {
    if (!this._ensureAuth()) return;

    if (!otherUid || otherUid === this.user.uid) {
      console.warn('Chat: Invalid chat target (self or empty)');
      return;
    }

    // Close any existing chat
    if (this.currentChatId) {
      this.closeChat();
    }

    this.currentOtherUid = otherUid;
    this.currentOtherName = otherName;
    this.currentOtherAvatar = otherAvatar;
    this.currentChatId = this._buildChatId(this.user.uid, otherUid);
    this.hasMoreMessages = true;
    this.oldestVisibleTimestamp = null;

    // Update header
    if (this.headerName) this.headerName.textContent = otherName;
    if (this.headerStatus) this.headerStatus.textContent = 'Online';
    if (this.headerAvatar) {
      if (otherAvatar) {
        this.headerAvatar.innerHTML = `<img src="${this._escapeHtml(otherAvatar)}" alt="${this._escapeHtml(otherName)}">`;
      } else {
        this.headerAvatar.textContent = otherName.charAt(0).toUpperCase();
      }
    }

    // Clear messages
    if (this.messagesEl) {
      this.messagesEl.innerHTML = '';
      this._renderLoadMore();
    }

    // Show panel
    this._showPanel(true);

    // Start listening
    this._listenMessages();

    // Focus input
    setTimeout(() => this.inputEl?.focus(), 300);
  }

  closeChat() {
    // Unsubscribe all listeners
    for (const [chatId, unsub] of this.unsubscribers) {
      try { unsub(); } catch (e) { /* ignore */ }
    }
    this.unsubscribers.clear();

    this.currentChatId = null;
    this.currentOtherUid = null;
    this.oldestVisibleTimestamp = null;
    this.hasMoreMessages = true;

    this._showPanel(false);
  }

  _showPanel(open) {
    if (!this.panel || !this.fab) return;
    if (open) {
      this.panel.classList.remove('hidden');
      this.fab.style.display = 'none';
    } else {
      this.panel.classList.add('hidden');
      this.fab.style.display = 'flex';
    }
  }

  // ── Chat ID ───────────────────────────
  _buildChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
  }

  // ── Message Listening ─────────────────
  _listenMessages() {
    if (!this.currentChatId) return;

    const messagesRef = collection(db, 'chats', this.currentChatId, 'messages');
    const q = query(
      messagesRef,
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      // Reverse to chronological order for display
      const docs = snapshot.docs.slice().reverse();

      if (docs.length < PAGE_SIZE) {
        this.hasMoreMessages = false;
        this._hideLoadMore();
      }

      if (docs.length > 0) {
        this.oldestVisibleTimestamp = docs[0].data().createdAt;
      }

      this._renderAllMessages(docs);
      this._scrollToBottom();
    }, (error) => {
      console.error('Chat listener error:', error);
      // Listener auto-unsubscribes on permanent error
      this.unsubscribers.delete(this.currentChatId);
    });

    this.unsubscribers.set(this.currentChatId, unsub);

    // Also listen to chat document for updates (e.g., other user changes)
    this._listenChatMeta();
  }

  _listenChatMeta() {
    if (!this.currentChatId) return;
    // Chat meta listener is optional; used for future features like typing indicator
  }

  // ── Load Older Messages (Pagination) ──
  async loadOlderMessages() {
    if (!this.currentChatId || !this.hasMoreMessages || this.isLoadingMore) return;
    if (!this.oldestVisibleTimestamp) return;

    this.isLoadingMore = true;
    this._setLoadMoreLoading(true);

    try {
      const messagesRef = collection(db, 'chats', this.currentChatId, 'messages');
      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(this.oldestVisibleTimestamp),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.slice().reverse();

      if (docs.length === 0) {
        this.hasMoreMessages = false;
        this._hideLoadMore();
        return;
      }

      if (docs.length < PAGE_SIZE) {
        this.hasMoreMessages = false;
        this._hideLoadMore();
      }

      // Update oldest timestamp
      this.oldestVisibleTimestamp = docs[0].data().createdAt;

      // Prepend older messages (maintain scroll position)
      const prevHeight = this.messagesEl.scrollHeight;
      this._prependMessages(docs);
      const newHeight = this.messagesEl.scrollHeight;
      this.messagesEl.scrollTop += (newHeight - prevHeight);
    } catch (error) {
      console.error('Load older messages failed:', error);
    } finally {
      this.isLoadingMore = false;
      this._setLoadMoreLoading(false);
    }
  }

  // ── Send Message ──────────────────────
  async sendMessage(text) {
    if (!this._ensureAuth()) return;
    if (!this.currentChatId) return;

    const trimmed = text.trim();

    // Client-side validation
    if (trimmed.length < MIN_CHARS) return;
    if (trimmed.length > MAX_CHARS) {
      this._showError(`訊息太長（最多 ${MAX_CHARS} 字元）`);
      return;
    }

    // Client-side rate limiting
    const now = Date.now();
    if (now - this.lastSendTime < COOLDOWN_MS) {
      this._showError('發送太快，請稍候再試');
      return;
    }
    this.lastSendTime = now;

    // Disable send button during send
    if (this.sendBtn) this.sendBtn.disabled = true;

    try {
      await this._doSend(trimmed);

      // Clear input
      if (this.inputEl) {
        this.inputEl.value = '';
        this._autoResizeInput();
        this.inputEl.focus();
      }
    } catch (error) {
      console.error('Send message failed:', error);
      if (error.code === 'permission-denied') {
        this._showError('發送失敗：權限不足或發送太頻密');
      } else {
        this._showError('發送失敗，請再試一次');
      }
    } finally {
      if (this.sendBtn) this.sendBtn.disabled = false;
    }
  }

  async _doSend(text) {
    const chatId = this.currentChatId;
    const batch = writeBatch(db);

    // 1. Create message document
    const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
    batch.set(msgRef, {
      from: this.user.uid,
      text: text,
      type: 'text',
      createdAt: serverTimestamp()
    });

    // 2. Update chat preview (denormalized, saves N reads for chat list)
    const chatRef = doc(db, 'chats', chatId);
    batch.update(chatRef, {
      lastMessagePreview: text.substring(0, 100),
      lastMessageAt: serverTimestamp(),
      lastMessageBy: this.user.uid
    });

    // 3. Update rate limit tracker (nested under users/{uid}/rateLimits/{chatId})
    const rateRef = doc(db, 'users', this.user.uid, 'rateLimits', chatId);
    batch.set(rateRef, {
      lastMessageAt: serverTimestamp()
    }, { merge: true });

    await batch.commit();
  }

  // ── Ensure Chat Document Exists ───────
  /**
   * Creates the chat document if it doesn't exist yet.
   * Called before sending the first message in a new conversation.
   */
  async ensureChatExists() {
    if (!this.currentChatId || !this.user) return false;

    const chatRef = doc(db, 'chats', this.currentChatId);

    try {
      // Try to create — Firestore rules allow create only if it doesn't exist
      await setDoc(chatRef, {
        participants: [this.user.uid, this.currentOtherUid].sort(),
        createdAt: serverTimestamp(),
        createdBy: this.user.uid,
        lastMessagePreview: '',
        lastMessageAt: serverTimestamp(),
        lastMessageBy: this.user.uid
      });
      return true;
    } catch (error) {
      // If already exists (permission-denied on create), that's fine
      if (error.code === 'permission-denied' || error.code === 'already-exists') {
        return true;
      }
      console.error('Failed to ensure chat exists:', error);
      return false;
    }
  }

  // ── Rendering ─────────────────────────
  _renderAllMessages(docs) {
    if (!this.messagesEl) return;

    // Preserve load-more element
    const loadMoreHtml = this.loadMoreEl ? this.loadMoreEl.outerHTML : '';

    const html = docs.map((doc, i) => {
      const data = doc.data();
      const isMine = data.from === (this.user?.uid);
      const time = data.createdAt ? this._formatTime(data.createdAt.toDate()) : '';

      // Date divider
      let dateDivider = '';
      if (i === 0 || this._isNewDay(docs[i - 1]?.data()?.createdAt, data.createdAt)) {
        const dateStr = data.createdAt ? this._formatDate(data.createdAt.toDate()) : '';
        dateDivider = `<div class="chat-date-divider"><span>${dateStr}</span></div>`;
      }

      if (data.type === 'system') {
        return `${dateDivider}<div class="chat-msg system"><div class="bubble">${this._escapeHtml(data.text)}</div></div>`;
      }

      return `${dateDivider}<div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
        <div class="bubble">${this._escapeHtml(data.text)}</div>
        <div class="time">${time}</div>
      </div>`;
    }).join('');

    this.messagesEl.innerHTML = loadMoreHtml + html;
  }

  _prependMessages(docs) {
    if (!this.messagesEl) return;

    const html = docs.map((doc, i) => {
      const data = doc.data();
      const isMine = data.from === (this.user?.uid);
      const time = data.createdAt ? this._formatTime(data.createdAt.toDate()) : '';

      if (data.type === 'system') {
        return `<div class="chat-msg system"><div class="bubble">${this._escapeHtml(data.text)}</div></div>`;
      }

      return `<div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
        <div class="bubble">${this._escapeHtml(data.text)}</div>
        <div class="time">${time}</div>
      </div>`;
    }).join('');

    // Insert after load-more, before existing messages
    const loadMore = this.messagesEl.querySelector('.chat-load-more');
    if (loadMore) {
      loadMore.insertAdjacentHTML('afterend', html);
    } else {
      this.messagesEl.insertAdjacentHTML('afterbegin', html);
    }
  }

  _renderLoadMore() {
    if (!this.messagesEl) return;
    this.messagesEl.innerHTML = `
      <div class="chat-load-more" id="chatLoadMore">
        <button class="chat-load-more-btn" id="chatLoadMoreBtn">載入更早訊息...</button>
      </div>
    `;
    this.loadMoreEl = document.getElementById('chatLoadMore');
    const loadMoreBtn = document.getElementById('chatLoadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.loadOlderMessages());
    }
  }

  _hideLoadMore() {
    if (this.loadMoreEl) {
      this.loadMoreEl.style.display = 'none';
    }
  }

  _setLoadMoreLoading(loading) {
    const btn = document.getElementById('chatLoadMoreBtn');
    if (btn) {
      btn.disabled = loading;
      btn.textContent = loading ? '載入中...' : '載入更早訊息...';
    }
  }

  _scrollToBottom() {
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  // ── Error Display ─────────────────────
  _showError(msg) {
    // Use existing toast if available, fallback to console
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'error');
    } else {
      console.warn('Chat:', msg);
    }
  }

  // ── Time Formatting ───────────────────
  _formatTime(date) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  _formatDate(date) {
    const now = new Date();
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();

    if (y === now.getFullYear() && m === (now.getMonth() + 1) && d === now.getDate()) {
      return '今天';
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (y === yesterday.getFullYear() && m === (yesterday.getMonth() + 1) && d === yesterday.getDate()) {
      return '昨天';
    }
    return `${y}/${m.toString().padStart(2, '0')}/${d.toString().padStart(2, '0')}`;
  }

  _isNewDay(prevTimestamp, currTimestamp) {
    if (!prevTimestamp || !currTimestamp) return false;
    const prev = prevTimestamp.toDate();
    const curr = currTimestamp.toDate();
    return prev.getFullYear() !== curr.getFullYear()
      || prev.getMonth() !== curr.getMonth()
      || prev.getDate() !== curr.getDate();
  }

  // ── Sanitization ───────────────────
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Auto-resize Textarea ─────────────
  _autoResizeInput() {
    if (!this.inputEl) return;
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 100) + 'px';
  }

  // ── Event Handlers ────────────────────
  _onFabClick() {
    if (!this._ensureAuth()) return;

    // Show the panel
    this._showPanel(true);

    // If no active chat, show a prompt or a simple contact selector
    // For MVP, demo: open chat with a test user (or show list)
    if (!this.currentChatId) {
      this._showChatList();
    }
  }

  _onCloseClick() {
    this.closeChat();
  }

  _onSendClick() {
    const text = this.inputEl?.value || '';
    this.sendMessage(text);
  }

  _onInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = this.inputEl?.value || '';
      this.sendMessage(text);
    }
  }

  _onScroll() {
    if (!this.messagesEl) return;
    // When user scrolls to the top, load older messages
    if (this.messagesEl.scrollTop < 50 && this.hasMoreMessages && !this.isLoadingMore) {
      this.loadOlderMessages();
    }
  }

  // ── Chat List (Simple for MVP) ────────
  _showChatList() {
    // For MVP, we create a chat with a hardcoded demo user
    // In production, this would query users or use a friend list
    this._renderEmptyState();
  }

  _renderEmptyState() {
    if (!this.messagesEl) return;
    this.messagesEl.innerHTML = `
      <div class="chat-empty">
        <span class="chat-empty-icon">💬</span>
        <p class="chat-empty-text">尚未開始對話</p>
        <p class="chat-empty-sub">請從社區頁面選擇一位成員開始聊天</p>
      </div>
    `;
  }
}

// ─────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────
const chat = new ChatManager();
export default chat;

// ── Global access for non-module scripts ──
window.PostAIAgeChat = chat;
