const modal = document.querySelector('#modal');
const content = document.querySelector('#modal-content');
const action = document.querySelector('#modal-action');
let strings = {};
let returnFocus;
const t = (key) => strings[key] ?? key;
// Local-only title preview. SDK integration belongs in the future platform adapter.
let reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
try {
  const saved = localStorage.getItem('lsr.title.reduceMotion');
  if (saved !== null) reduceMotion = saved === 'true';
} catch { /* Storage can be unavailable in private or embedded browsers. */ }
function applyMotion() { document.documentElement.classList.toggle('reduce-motion', reduceMotion); }
applyMotion();

function textElement(tag, key, className) {
  const element = document.createElement(tag);
  element.textContent = t(key);
  if (className) element.className = className;
  return element;
}
function openModal(kind) {
  returnFocus = document.activeElement;
  content.replaceChildren();
  document.querySelector('#modal-kicker').textContent = t(`${kind}.kicker`);
  document.querySelector('#modal-title').textContent = t(kind === 'settings' ? 'ui.settings' : `${kind}.title`);
  if (kind === 'settings') {
    const label = document.createElement('label');
    label.className = 'setting-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = reduceMotion;
    input.addEventListener('change', () => {
      reduceMotion = input.checked;
      applyMotion();
      try { localStorage.setItem('lsr.title.reduceMotion', String(reduceMotion)); } catch { /* Keep the setting for this session. */ }
    });
    label.append(textElement('span', 'settings.reduceMotion'), input);
    content.append(label, textElement('p', 'settings.motionDetail', 'modal-copy'));
  } else {
    content.append(textElement('p', 'preview.detail', 'modal-copy'));
  }
  action.textContent = t(kind === 'settings' ? 'ui.done' : 'preview.back');
  modal.showModal();
  action.focus();
}
document.querySelector('#close-modal').addEventListener('click', () => modal.close());
action.addEventListener('click', () => modal.close());
modal.addEventListener('close', () => returnFocus?.focus());
// Native dialog handles focus containment and Escape without preventing the platform shortcut.
async function init() {
  const response = await fetch('./locales/en.json');
  if (!response.ok) throw new Error(`Locale load failed: ${response.status}`);
  strings = await response.json();
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  let bestScore = 0;
  try {
    const saved = Number(localStorage.getItem('lsr.bestScore'));
    if (Number.isSafeInteger(saved) && saved >= 0) bestScore = saved;
  } catch { /* Show zero when local storage is unavailable. */ }
  document.querySelector('#high-score').textContent = bestScore.toLocaleString('en-US');
  document.querySelector('#close-modal').ariaLabel = t('ui.close');
  document.querySelector('#play').addEventListener('click', () => openModal('preview'));
  document.querySelector('#settings').addEventListener('click', () => openModal('settings'));
  document.addEventListener('keydown', (event) => {
    if (!modal.open && !event.repeat && (event.key === 'Enter' || event.code === 'Space') && (document.activeElement === document.body || document.activeElement === document.documentElement)) {
      event.preventDefault();
      openModal('preview');
    }
  });
}
init().catch((error) => { console.error(error); document.querySelector('#load-error').hidden = false; });
