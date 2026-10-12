import { db } from './auth.js?v=8';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const planStep = document.getElementById('inquiryPlanStep');
const formStep = document.getElementById('inquiryFormStep');
const form = document.getElementById('inquiryForm');
const status = document.getElementById('inquiryStatus');
const submit = document.getElementById('inquirySubmit');
let selectedPlan = null;

// Must match the consultationRequests rules in firestore.rules.
const PROBLEM_MIN_CHARS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Count characters the way the rules do (an emoji is one character, not two).
function charCount(text) {
  return Array.from(text).length;
}

function showFormError(message, field) {
  status.textContent = message;
  if (field) document.getElementById(field).focus();
}

function choosePlan(plan) {
  selectedPlan = plan;
  document.querySelectorAll('.inquiry-plan').forEach((card) => {
    card.classList.toggle('selected', card.dataset.plan === plan);
  });
  document.getElementById('inquiryTitle').textContent = plan === 'A'
    ? '先聊聊你自己的工作'
    : '先聊聊團隊的一個流程';
  planStep.classList.add('hidden');
  formStep.classList.remove('hidden');
  document.getElementById('inquiryName').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.inquiry-plan').forEach((card) => {
  card.addEventListener('click', () => choosePlan(card.dataset.plan));
});

document.getElementById('changeInquiryPlan').addEventListener('click', () => {
  formStep.classList.add('hidden');
  planStep.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

const requestedPlan = new URLSearchParams(window.location.search).get('plan');
if (requestedPlan === 'A' || requestedPlan === 'B') {
  document.querySelectorAll('.inquiry-plan').forEach((card) => {
    card.classList.toggle('selected', card.dataset.plan === requestedPlan);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('inquiryName').value.trim();
  const email = document.getElementById('inquiryEmail').value.trim();
  const problem = document.getElementById('inquiryProblem').value.trim();
  const consent = document.getElementById('inquiryConsent').checked;

  if (!selectedPlan) {
    showFormError('請先選擇個人或團隊方向。');
    return;
  }
  if (!name) {
    showFormError('請告訴我們怎樣稱呼你。', 'inquiryName');
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    showFormError('這個電郵地址好像不完整，請再檢查一次。', 'inquiryEmail');
    return;
  }
  if (charCount(problem) < PROBLEM_MIN_CHARS) {
    showFormError(`請多寫幾句（至少 ${PROBLEM_MIN_CHARS} 個字），讓我們先了解你的情況。`, 'inquiryProblem');
    return;
  }
  if (!consent) {
    showFormError('請勾選同意，我們才能用這些資料回覆你。', 'inquiryConsent');
    return;
  }

  submit.disabled = true;
  submit.textContent = '正在送出…';
  status.textContent = '';
  try {
    await addDoc(collection(db, 'consultationRequests'), {
      plan: selectedPlan,
      name,
      email,
      problem,
      consent: true,
      source: 'website',
      createdAt: serverTimestamp()
    });
    window.location.href = '/request-received?plan=' + encodeURIComponent(selectedPlan);
  } catch (error) {
    console.error('Consultation request failed:', error);
    status.textContent = error.code === 'permission-denied'
      ? '資料格式未能通過檢查，請檢查各欄位後再試，或電郵 contact@postaiage.com 聯絡我們。'
      : '這次沒有成功送出，請檢查網絡後再試，或電郵 contact@postaiage.com 聯絡我們。';
    submit.disabled = false;
    submit.textContent = '提交申請，安排對話 →';
  }
});
