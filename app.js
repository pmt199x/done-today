'use strict';

/* ==========================================================================
   Helpers
   ========================================================================== */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ESC_MAP[c]);
/* Inline SVG icon from the sprite in index.html. size: xs 14 · sm 16 · md 20 · lg 24 · xl 32 (see styles.css). */
const icon = (name, size = 'md', cls = '') => `<svg class="i i-${size}${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const setIcon = (svg, name) => { const use = svg && svg.querySelector('use'); if (use) use.setAttribute('href', `#i-${name}`); };
const uid = () => Math.random().toString(36).slice(2, 10);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = ms => (reducedMotion() ? 0 : ms);
function vibrate(ms = 10) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* unsupported */ } }

/* ==========================================================================
   Dates (all dates are local YYYY-MM-DD strings)
   ========================================================================== */
const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const todayISO = () => toISO(new Date());
const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const tomorrowISO = () => addDays(todayISO(), 1);
const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
const isISODate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function longDate(iso) {
  const d = fromISO(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
}
function relativeDay(iso) {
  const today = todayISO();
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  if (diff === -1) return 'Hôm qua';
  const d = fromISO(iso);
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()];
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()}/${d.getMonth() + 1}${sameYear ? '' : '/' + d.getFullYear()}`;
}
const lowerFirst = s => s.charAt(0).toLowerCase() + s.slice(1);

/* ==========================================================================
   Storage — schema is unchanged from v1:
   { lastOpened, tasks: [{ id, name, date, priority, done, note, time, subtasks: [{ id, name, done }] }],
     notes: [{ id, text, createdAt }] }
   New optional fields: task.completedAt, note.updatedAt.
   ========================================================================== */
const STORAGE_KEY = 'done-today-v1';
const UI_KEY = 'done-today-ui';
const PRIORITIES = [
  { key: 'must', label: 'Phải làm', icon: 'flag' },
  { key: 'should', label: 'Nên làm', icon: 'circle-dot' },
  { key: 'later', label: 'Có thời gian', icon: 'leaf' }
];
const PRIORITY_KEYS = PRIORITIES.map(p => p.key);
const priorityOf = key => PRIORITIES.find(p => p.key === key) || PRIORITIES[1];
const priorityLabel = key => priorityOf(key).label;
const priorityIcon = key => priorityOf(key).icon;

function createSeed() {
  const today = todayISO();
  return {
    lastOpened: today,
    tasks: [
      { id: uid(), name: 'Review PR #128', date: today, priority: 'must', done: true, note: '', time: '', subtasks: [], completedAt: new Date().toISOString() },
      { id: uid(), name: 'Fix duplicate HITR issue', date: today, priority: 'must', done: false, note: 'Kiểm tra điều kiện VALIDFLAG và flow a100HitrExist().', time: '', subtasks: [
        { id: uid(), name: 'Reproduce bug', done: true },
        { id: uid(), name: 'Check a100HitrExist()', done: true },
        { id: uid(), name: 'Fix query', done: false },
        { id: uid(), name: 'Test Index Fund', done: false }
      ] },
      { id: uid(), name: 'Reply email to supplier', date: today, priority: 'should', done: false, note: '', time: '14:00', subtasks: [] },
      { id: uid(), name: 'Practice English 20 min', date: today, priority: 'later', done: false, note: '', time: '', subtasks: [] }
    ],
    notes: [
      { id: uid(), text: 'Ý tưởng: kiểm tra vì sao VALIDFLAG = 3 không được đọc.', createdAt: new Date().toISOString() }
    ]
  };
}

function normalizeTask(t) {
  return Object.assign(t, {
    id: t.id != null && t.id !== '' ? String(t.id) : uid(),
    name: typeof t.name === 'string' ? t.name : String(t.name ?? ''),
    date: isISODate(t.date) ? t.date : todayISO(),
    priority: PRIORITY_KEYS.includes(t.priority) ? t.priority : 'should',
    done: !!t.done,
    note: typeof t.note === 'string' ? t.note : '',
    time: typeof t.time === 'string' && /^\d{2}:\d{2}$/.test(t.time) ? t.time : '',
    subtasks: Array.isArray(t.subtasks)
      ? t.subtasks.filter(s => s && typeof s === 'object').map(s => Object.assign(s, {
        id: s.id != null && s.id !== '' ? String(s.id) : uid(),
        name: typeof s.name === 'string' ? s.name : String(s.name ?? ''),
        done: !!s.done
      }))
      : []
  });
}
function normalizeNote(n) {
  const valid = typeof n.createdAt === 'string' && !Number.isNaN(Date.parse(n.createdAt));
  return Object.assign(n, {
    id: n.id != null && n.id !== '' ? String(n.id) : uid(),
    text: typeof n.text === 'string' ? n.text : String(n.text ?? ''),
    createdAt: valid ? n.createdAt : new Date().toISOString()
  });
}
function normalizeState(raw) {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  s.tasks = Array.isArray(s.tasks) ? s.tasks.filter(t => t && typeof t === 'object').map(normalizeTask) : [];
  s.notes = Array.isArray(s.notes) ? s.notes.filter(n => n && typeof n === 'object').map(normalizeNote) : [];
  if (!isISODate(s.lastOpened)) s.lastOpened = todayISO();
  return s;
}

function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { return createSeed(); }
  if (!raw) return createSeed();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    // Never silently drop unreadable data: keep a copy before falling back.
    try { localStorage.setItem(`${STORAGE_KEY}-backup-${Date.now()}`, raw); } catch { /* quota */ }
    return createSeed();
  }
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    showToast('Không thể lưu dữ liệu trên thiết bị này');
    return false;
  }
}
function loadUI() {
  try {
    const v = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
    return { collapsed: v && typeof v.collapsed === 'object' && v.collapsed ? v.collapsed : {} };
  } catch { return { collapsed: {} }; }
}
function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* ignore */ } }

/* ==========================================================================
   Natural-language parser
   Supports: mai / ngày mai / tomorrow, mốt / ngày kia, hôm nay / today, thứ 2…7 / chủ nhật,
   weekday names, sáng/chiều/tối mai, 9h / 9h30 / 9:30 / 9am / 3h chiều / lúc 9,
   !gấp / urgent / must, !later / rảnh.
   ========================================================================== */
const TOKEN_START = '(^|[\\s,(])';
const TOKEN_END = '(?=$|[\\s,.;:!?)])';
const tokenRe = body => new RegExp(`${TOKEN_START}(?:${body})${TOKEN_END}`, 'iu');

const PERIOD = '(?:\\s*(sáng|trưa|chiều|tối|am|pm))?';
const DAYPART_RE = tokenRe('(sáng|trưa|chiều|tối)\\s+(ngày\\s+mai|mai|hôm\\s+nay|nay)');
const DATE_RULES = [
  { re: tokenRe('ngày\\s+kia|ngày\\s+mốt|mốt|day\\s+after\\s+tomorrow'), offset: () => 2 },
  { re: tokenRe('ngày\\s+mai|mai|tomorrow|tmr'), offset: () => 1 },
  { re: tokenRe('hôm\\s+nay|today'), offset: () => 0 },
  {
    re: tokenRe('thứ\\s*(2|3|4|5|6|7|hai|ba|tư|năm|sáu|bảy)|(chủ\\s+nhật)|(monday|tuesday|wednesday|thursday|friday|saturday|sunday)'),
    offset: m => {
      const vi = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, hai: 1, ba: 2, 'tư': 3, 'năm': 4, 'sáu': 5, 'bảy': 6 };
      const en = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const target = m[2] ? vi[m[2].toLowerCase()] : m[3] ? 0 : en.indexOf(m[4].toLowerCase());
      return (target - new Date().getDay() + 7) % 7;
    }
  }
];
const TIME_RULES = [
  tokenRe(`(?:(?:lúc|at|@)\\s*)?(\\d{1,2}):(\\d{2})${PERIOD}`),
  tokenRe(`(?:(?:lúc|at|@)\\s*)?(\\d{1,2})\\s*(?:h|giờ)(?:\\s*(\\d{2}))?(?:\\s*(?:p|phút))?${PERIOD}`),
  tokenRe('(?:(?:lúc|at|@)\\s*)?(\\d{1,2})()\\s*(am|pm)'),
  tokenRe(`(?:lúc|at|@)\\s*(\\d{1,2})()${PERIOD}`)
];
const PRIORITY_RULES = [
  { re: tokenRe('!gấp|!gap|!urgent|urgent|!must|must|!1'), priority: 'must' },
  { re: tokenRe('!later|!rảnh|rảnh|ranh|!3'), priority: 'later' },
  { re: tokenRe('!should|!nên|!2'), priority: 'should' }
];

function takeToken(s, re) {
  const m = re.exec(s);
  if (!m) return null;
  return { m, rest: `${s.slice(0, m.index)}${m[1] || ''} ${s.slice(m.index + m[0].length)}` };
}
function applyPeriod(h, period) {
  const p = (period || '').toLowerCase();
  if ((p === 'pm' || p === 'chiều' || p === 'tối') && h < 12) return h + 12;
  if (p === 'trưa' && h < 5) return h + 12;
  if ((p === 'am' || p === 'sáng') && h === 12) return 0;
  return h;
}

function parseNatural(input, baseDate = todayISO(), skip = {}) {
  const original = String(input || '').normalize('NFC').trim();
  let s = original;
  let date = baseDate;
  let time = '';
  let priority = 'should';
  let dayPeriod = '';
  const detected = { date: false, time: false, priority: false };
  const today = todayISO();

  if (!skip.priority) {
    for (const rule of PRIORITY_RULES) {
      const r = takeToken(s, rule.re);
      if (r) { priority = rule.priority; detected.priority = true; s = r.rest; break; }
    }
  }

  if (!skip.date) {
    const dp = takeToken(s, DAYPART_RE);
    if (dp) {
      dayPeriod = dp.m[2];
      date = /mai/i.test(dp.m[3]) ? addDays(today, 1) : today;
      detected.date = true;
      s = dp.rest;
    } else {
      for (const rule of DATE_RULES) {
        const r = takeToken(s, rule.re);
        if (r) { date = addDays(today, rule.offset(r.m)); detected.date = true; s = r.rest; break; }
      }
    }
  }

  if (!skip.time) {
    for (const re of TIME_RULES) {
      const r = takeToken(s, re);
      if (!r) continue;
      let h = Number(r.m[2]);
      const min = r.m[3] ? Number(r.m[3]) : 0;
      if (h > 23 || min > 59) continue;
      h = applyPeriod(h, r.m[4] || dayPeriod);
      time = `${pad(h)}:${pad(min)}`;
      detected.time = true;
      s = r.rest;
      break;
    }
  }

  const name = s.replace(/\s+/g, ' ').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '').trim();
  return { name: name || original, date, time, priority, detected };
}

/* ==========================================================================
   App state
   ========================================================================== */
let state = loadState();
const ui = loadUI();
const view = {
  tab: 'today',
  selectedDate: todayISO(),
  calMonth: todayISO().slice(0, 7)
};
let newTaskId = null;
let renderTimer = null;

const screen = $('#screen');
const TITLES = { today: 'Hôm nay', calendar: 'Lịch', notes: 'Ghi chú', me: 'Tôi' };

const findTask = id => state.tasks.find(t => t.id === id);
function setDone(t, done) {
  t.done = done;
  if (done) t.completedAt = new Date().toISOString();
  else delete t.completedAt;
}
const shiftTarget = t => (t.date <= todayISO() ? tomorrowISO() : addDays(t.date, 1));

/* Open tasks first (timed ones by time, then insertion order), completed tasks last. */
function sortTasks(list) {
  return list
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      if (a.t.done !== b.t.done) return a.t.done ? 1 : -1;
      if (!a.t.done) {
        if (a.t.time && b.t.time && a.t.time !== b.t.time) return a.t.time.localeCompare(b.t.time);
        if (!!a.t.time !== !!b.t.time) return a.t.time ? -1 : 1;
      }
      return a.i - b.i;
    })
    .map(x => x.t);
}

/* ==========================================================================
   Toast
   ========================================================================== */
const toastEl = $('#toast');
let toastTimer = null;
let toastUndo = null;
function hideToast() { toastEl.classList.remove('show'); toastUndo = null; }
function showToast(msg, { undo } = {}) {
  $('#toastMsg').textContent = msg;
  toastUndo = undo || null;
  $('#toastAction').hidden = !undo;
  toastEl.classList.toggle('has-action', !!undo);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? 4500 : 2000);
}
$('#toastAction').addEventListener('click', () => {
  const fn = toastUndo;
  clearTimeout(toastTimer);
  hideToast();
  if (fn) { fn(); vibrate(); }
});

/* ==========================================================================
   Task mutations
   ========================================================================== */
function toggleTask(id, sourceEl) {
  const t = findTask(id);
  if (!t) return;
  setDone(t, !t.done);
  saveState();
  vibrate(t.done ? 12 : 6);

  const row = sourceEl && sourceEl.closest('.task');
  if (!row) { render(); return; }
  row.classList.toggle('is-done', t.done);
  const check = $('.check', row);
  check.setAttribute('aria-checked', String(t.done));
  check.classList.remove('is-popping');
  void check.offsetWidth;
  if (t.done) check.classList.add('is-popping');
  updateProgressInPlace();
  scheduleRender(motion(450));
}

function deleteTask(id) {
  const idx = state.tasks.findIndex(t => t.id === id);
  if (idx < 0) return;
  const [removed] = state.tasks.splice(idx, 1);
  saveState();
  render();
  showToast('Đã xóa công việc', {
    undo: () => {
      state.tasks.splice(Math.min(idx, state.tasks.length), 0, removed);
      saveState();
      render();
    }
  });
}

function shiftTask(id) {
  const t = findTask(id);
  if (!t) return;
  const prev = t.date;
  t.date = shiftTarget(t);
  saveState();
  render();
  showToast(`Đã dời sang ${lowerFirst(relativeDay(t.date))}`, {
    undo: () => { t.date = prev; saveState(); render(); }
  });
}

/* ==========================================================================
   Rendering
   ========================================================================== */
function scheduleRender(delay) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    if (gesture) { scheduleRender(120); return; }
    render();
  }, delay);
}

function render() {
  clearTimeout(renderTimer);
  syncChrome();
  const views = { today: renderToday, calendar: renderCalendar, notes: renderNotes, me: renderMe };
  screen.innerHTML = views[view.tab]();
  newTaskId = null;
}

function syncChrome() {
  $$('.tab').forEach(tab => {
    if (tab.dataset.tab === view.tab) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  const fab = $('#fab');
  fab.hidden = view.tab === 'me';
  fab.setAttribute('aria-label', view.tab === 'notes' ? 'Thêm ghi chú' : view.tab === 'calendar' ? 'Thêm công việc cho ngày đã chọn' : 'Thêm công việc');
  $('#navCompactTitle').textContent = TITLES[view.tab];
  document.title = view.tab === 'today' ? 'Done Today' : `${TITLES[view.tab]} · Done Today`;
}

function pageHeader(title, eyebrow, actions = '') {
  return `<header class="page-header">
    <div><p class="page-eyebrow">${esc(eyebrow)}</p><h1 class="page-title">${esc(title)}</h1></div>
    ${actions ? `<div class="page-header-actions">${actions}</div>` : ''}
  </header>`;
}

function metaItem(name, text, { cls = '', sr = '' } = {}) {
  return `<span class="meta-item${cls ? ' ' + cls : ''}">${icon(name, 'xs')}${text ? `<span>${esc(text)}</span>` : ''}${sr ? `<span class="sr-only">${esc(sr)}</span>` : ''}</span>`;
}

function taskRow(t, { showDate = false, showPriority = false } = {}) {
  const subs = t.subtasks || [];
  const subDone = subs.filter(s => s.done).length;
  const meta = [];
  if (showDate) meta.push(metaItem('calendar', relativeDay(t.date)));
  if (showPriority && t.priority === 'must') meta.push(metaItem(priorityIcon(t.priority), priorityLabel(t.priority), { cls: 'is-priority' }));
  if (t.time) meta.push(metaItem('clock', t.time));
  if (subs.length) {
    meta.push(metaItem('list-checks', `${subDone}/${subs.length}`, {
      cls: subDone === subs.length ? 'is-complete' : '',
      sr: ` bước đã xong`
    }));
  }
  if (t.note) meta.push(metaItem('file-text', '', { sr: 'Có ghi chú' }));
  const name = esc(t.name);
  const classes = ['task', t.done && 'is-done', t.id === newTaskId && 'is-new'].filter(Boolean).join(' ');

  return `<div class="${classes}" role="listitem" data-id="${esc(t.id)}" data-priority="${t.priority}">
    <div class="swipe-bg swipe-bg-shift" aria-hidden="true">${icon('calendar-forward')}<span>${esc(relativeDay(shiftTarget(t)))}</span></div>
    <div class="swipe-bg swipe-bg-delete" aria-hidden="true"><span>Xóa</span>${icon('trash')}</div>
    <div class="task-card">
      <button type="button" class="check" role="checkbox" aria-checked="${t.done}" aria-label="Hoàn thành: ${name}" data-action="toggle">${icon('check', 'sm')}</button>
      <button type="button" class="task-body" data-action="open">
        <span class="task-name">${name}</span>
        ${meta.length ? `<span class="task-meta">${meta.join('')}</span>` : ''}
      </button>
      <button type="button" class="icon-btn icon-btn-subtle task-more" data-action="menu" aria-label="Tùy chọn: ${name}">${icon('ellipsis')}</button>
    </div>
  </div>`;
}

function progressText(done, total) {
  if (total && done === total) return `<span>Đã xong tất cả <strong>${total}</strong> việc</span>`;
  return `<span>Đã xong <strong>${done}/${total}</strong> việc</span>`;
}
function progressHTML(done, total) {
  const ratio = total ? done / total : 0;
  return `<div class="progress${total && done === total ? ' is-complete' : ''}" id="todayProgress">
    <div class="progress-text">${progressText(done, total)}</div>
    <div class="progress-track" role="progressbar" aria-label="Tiến độ hôm nay" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">
      <span class="progress-fill" style="--v:${ratio}"></span>
    </div>
  </div>`;
}
function updateProgressInPlace() {
  const el = $('#todayProgress');
  if (!el) return;
  const tasks = state.tasks.filter(t => t.date === todayISO());
  const done = tasks.filter(t => t.done).length;
  const ratio = tasks.length ? done / tasks.length : 0;
  el.classList.toggle('is-complete', !!tasks.length && done === tasks.length);
  $('.progress-text', el).innerHTML = progressText(done, tasks.length);
  $('.progress-fill', el).style.setProperty('--v', ratio);
  $('.progress-track', el).setAttribute('aria-valuenow', done);
}

function sectionHTML(p, list) {
  const open = list.filter(t => !t.done).length;
  const collapsed = !!ui.collapsed[p.key];
  const count = open ? String(open) : icon('check', 'sm');
  const countSr = open ? ` — ${open} việc chưa xong` : ' — đã xong hết';
  return `<section class="section${collapsed ? ' is-collapsed' : ''}" data-priority="${p.key}">
    <h2 class="section-head">
      <button type="button" class="section-toggle" data-action="toggle-section" data-key="${p.key}" aria-expanded="${!collapsed}" aria-controls="list-${p.key}">
        ${icon(p.icon, 'md', 'prio-icon')}
        <span class="section-name">${p.label}</span>
        <span class="section-count"><span aria-hidden="true">${count}</span><span class="sr-only">${countSr}</span></span>
        ${icon('chevron-down', 'md', 'section-chevron')}
      </button>
    </h2>
    <div class="task-list" id="list-${p.key}" role="list">${list.map(t => taskRow(t)).join('')}</div>
  </section>`;
}

function renderToday() {
  const today = todayISO();
  const tasks = state.tasks.filter(t => t.date === today);
  const done = tasks.filter(t => t.done).length;
  let html = pageHeader('Hôm nay', longDate(today));

  if (!tasks.length) {
    return html + `<div class="empty">
      <div class="empty-icon">${icon('sun', 'xl')}</div>
      <h2>Hôm nay bạn đang rảnh.</h2>
      <p>Thêm việc mới bất cứ khi nào bạn nghĩ ra.</p>
      <button type="button" class="pill-btn" data-action="add">${icon('plus')}Thêm việc</button>
    </div>`;
  }

  html += progressHTML(done, tasks.length);
  for (const p of PRIORITIES) {
    const list = sortTasks(tasks.filter(t => t.priority === p.key));
    if (list.length) html += sectionHTML(p, list);
  }
  return html;
}

function renderCalendar() {
  const today = todayISO();
  const sel = view.selectedDate;
  const [y, m] = view.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1, 12);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leading = (first.getDay() + 6) % 7;

  const byDate = {};
  for (const t of state.tasks) {
    const e = byDate[t.date] || (byDate[t.date] = { open: 0, done: 0 });
    if (t.done) e.done++; else e.open++;
  }

  let cells = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('');
  for (let i = 0; i < leading; i++) cells += '<div aria-hidden="true"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const info = byDate[iso];
    const cls = ['cal-day', iso === today && 'is-today', iso < today && 'is-past', info && info.open && 'has-open', info && info.done && 'has-done'].filter(Boolean).join(' ');
    const sr = `${longDate(iso)}${info ? `, ${info.open + info.done} việc` : ''}`;
    cells += `<button type="button" class="${cls}" data-action="select-date" data-date="${iso}" aria-pressed="${iso === sel}" aria-label="${esc(sr)}"><span class="cal-day-num">${d}</span></button>`;
  }

  const isCurrentMonth = view.calMonth === today.slice(0, 7);
  const todayBtn = !isCurrentMonth || sel !== today
    ? `<button type="button" class="pill-btn cal-today-btn" data-action="cal-today">Hôm nay</button>` : '';

  const dayTasks = state.tasks.filter(t => t.date === sel);
  const sorted = PRIORITY_KEYS.flatMap(k => sortTasks(dayTasks.filter(t => t.priority === k)));
  const sortedDone = [...sorted.filter(t => !t.done), ...sorted.filter(t => t.done)];
  const open = dayTasks.filter(t => !t.done).length;
  const dayTitle = Math.abs(daysBetween(today, sel)) <= 1 ? `${relativeDay(sel)}` : longDate(sel);

  let html = pageHeader('Lịch', 'Kế hoạch theo ngày');
  html += `<div class="cal-card">
    <div class="cal-head">
      <h2 class="cal-month">Tháng ${m}, ${y}</h2>
      <div class="cal-nav">
        ${todayBtn}
        <button type="button" class="icon-btn icon-btn-subtle" data-action="cal-prev" aria-label="Tháng trước">${icon('chevron-left', 'lg')}</button>
        <button type="button" class="icon-btn icon-btn-subtle" data-action="cal-next" aria-label="Tháng sau">${icon('chevron-right', 'lg')}</button>
      </div>
    </div>
    <div class="cal-grid">${cells}</div>
  </div>`;

  html += `<section class="section">
    <h2 class="list-title">${esc(dayTitle)}<small>${dayTasks.length ? `${open} chưa xong` : ''}</small></h2>
    <div class="task-list" role="list">${sortedDone.map(t => taskRow(t, { showPriority: true })).join('')
      || `<div class="empty-inline">${icon('calendar-check', 'xl')}<span>Chưa có việc nào. <button type="button" class="link-btn" data-action="add">Thêm việc</button></span></div>`}</div>
  </section>`;

  if (sel === today) {
    const upcoming = state.tasks
      .filter(t => t.date > today && !t.done)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99'))
      .slice(0, 6);
    if (upcoming.length) {
      html += `<section class="section">
        <h2 class="list-title">Sắp tới<small>${upcoming.length}</small></h2>
        <div class="task-list" role="list">${upcoming.map(t => taskRow(t, { showDate: true, showPriority: true })).join('')}</div>
      </section>`;
    }
  }
  return html;
}

function noteDate(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const iso = toISO(d);
  const diff = daysBetween(todayISO(), iso);
  if (diff === 0) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diff === -1) return 'Hôm qua';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()}/${d.getMonth() + 1}${sameYear ? '' : '/' + d.getFullYear()}`;
}

function renderNotes() {
  const notes = [...state.notes].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  let html = pageHeader('Ghi chú', notes.length ? `${notes.length} ghi chú` : 'Ghi lại mọi ý nghĩ');
  if (!notes.length) {
    return html + `<div class="empty">
      <div class="empty-icon">${icon('sticky-note', 'xl')}</div>
      <h2>Chưa có ghi chú</h2>
      <p>Lưu nhanh ý tưởng, thông tin hay điều cần nhớ.</p>
      <button type="button" class="pill-btn" data-action="add">${icon('plus')}Ghi chú mới</button>
    </div>`;
  }
  html += `<div class="note-list">${notes.map(n => {
    const lines = n.text.trim().split(/\n+/);
    const title = lines[0] || 'Ghi chú trống';
    const preview = lines.slice(1).join(' ').trim();
    return `<button type="button" class="note-card" data-action="open-note" data-id="${esc(n.id)}">
      <span class="note-title">${esc(title)}</span>
      ${preview ? `<span class="note-preview">${esc(preview)}</span>` : ''}
      <span class="note-date">${esc(noteDate(n.createdAt))}</span>
    </button>`;
  }).join('')}</div>`;
  return html;
}

function completionDay(t) {
  if (t.completedAt) {
    const d = new Date(t.completedAt);
    if (!Number.isNaN(d.getTime())) return toISO(d);
  }
  return t.date;
}

function renderMe() {
  const today = todayISO();
  const all = state.tasks.length;
  const done = state.tasks.filter(t => t.done).length;
  const todayTasks = state.tasks.filter(t => t.date === today);
  const todayDone = todayTasks.filter(t => t.done).length;

  const doneByDay = {};
  for (const t of state.tasks) if (t.done) { const d = completionDay(t); doneByDay[d] = (doneByDay[d] || 0) + 1; }
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const weekCounts = week.map(d => doneByDay[d] || 0);
  const weekTotal = weekCounts.reduce((a, b) => a + b, 0);
  const maxCount = Math.max(1, ...weekCounts);

  let streak = 0;
  let cursor = doneByDay[today] ? today : addDays(today, -1);
  while (doneByDay[cursor]) { streak++; cursor = addDays(cursor, -1); }

  const swReady = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;

  const stat = (iconName, value, label) => `<div class="card stat-card">
    <span class="stat-value">${value}</span>
    <span class="stat-caption">${icon(iconName, 'xs')}${label}</span>
  </div>`;
  const settingRow = (iconName, label, value) => `<div class="group-row">
    <span class="row-label">${icon(iconName)}${label}</span><span class="row-value">${value}</span>
  </div>`;

  let html = pageHeader('Tôi', 'Tiến độ của bạn');
  html += `<div class="stat-grid">
    ${stat('check-circle', `${todayDone}<small class="stat-of">/${todayTasks.length}</small>`, 'Xong hôm nay')}
    ${stat('gauge', `${all ? Math.round(done / all * 100) : 0}%`, 'Tỷ lệ hoàn thành')}
    ${stat('chart', weekTotal, 'Xong trong 7 ngày')}
    ${stat('circle', all - done, 'Đang mở')}
  </div>`;
  if (streak >= 2) {
    html += `<p class="streak-line">${icon('flame', 'sm')}<span><strong>${streak} ngày</strong> liên tiếp hoàn thành ít nhất một việc</span></p>`;
  }
  html += `<div class="card week-card">
    <div class="week-head"><h2>7 ngày qua</h2><span>${weekTotal} việc đã xong</span></div>
    <div class="week-bars" role="img" aria-label="${esc(week.map((d, i) => `${WEEKDAYS[fromISO(d).getDay()]}: ${weekCounts[i]}`).join(', '))}">
      ${week.map((d, i) => {
        const c = weekCounts[i];
        return `<div class="week-bar${c ? ' has-value' : ''}${d === today ? ' is-today' : ''}">
          <span class="week-bar-count">${c || ''}</span>
          <span class="week-bar-track"><span class="week-bar-fill" style="height:${c ? Math.max(8, c / maxCount * 100) : 0}%"></span></span>
          <span class="week-bar-label">${WEEKDAYS_SHORT[fromISO(d).getDay()]}</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
  html += `<div class="group settings-group">
    ${settingRow('calendar-forward', 'Tự chuyển việc chưa xong', 'Bật')}
    ${settingRow('sticky-note', 'Ghi chú', state.notes.length)}
    ${settingRow('database', 'Lưu dữ liệu', 'Trên thiết bị')}
    ${settingRow('smartphone', 'Dùng ngoại tuyến', swReady ? 'Sẵn sàng' : 'Sau lần mở kế tiếp')}
  </div>
  <p class="app-footnote">Done Today · Dữ liệu chỉ lưu trên trình duyệt này</p>`;
  return html;
}

/* ==========================================================================
   Screen interactions (event delegation)
   ========================================================================== */
let suppressClickUntil = 0;
const suppressClicks = () => { suppressClickUntil = Date.now() + 450; };

screen.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const holder = el.closest('[data-id]');
  const id = holder && holder.dataset.id;
  switch (el.dataset.action) {
    case 'toggle': toggleTask(id, el); break;
    case 'open': openDetail(id); break;
    case 'menu': openActions(id); break;
    case 'add': openQuick({ date: view.tab === 'calendar' ? view.selectedDate : undefined }); break;
    case 'toggle-section': toggleSection(el); break;
    case 'select-date': view.selectedDate = el.dataset.date; render(); break;
    case 'cal-prev': shiftMonth(-1); break;
    case 'cal-next': shiftMonth(1); break;
    case 'cal-today': view.selectedDate = todayISO(); view.calMonth = todayISO().slice(0, 7); render(); break;
    case 'open-note': openNote(id); break;
    default: break;
  }
});

function toggleSection(btn) {
  const key = btn.dataset.key;
  ui.collapsed[key] = !ui.collapsed[key];
  saveUI();
  btn.setAttribute('aria-expanded', String(!ui.collapsed[key]));
  btn.closest('.section').classList.toggle('is-collapsed', !!ui.collapsed[key]);
}
function shiftMonth(delta) {
  const [y, m] = view.calMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1, 12);
  view.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  render();
}

/* Swipe (right → shift a day, left → delete) and long-press (→ actions) */
const LOCK_PX = 10;
const LONG_PRESS_MS = 480;
let gesture = null;

screen.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const card = e.target.closest('.task-card');
  if (!card || gesture) return;
  const row = card.closest('.task');
  const now = performance.now();
  gesture = {
    row, card, id: row.dataset.id, pointerId: e.pointerId,
    x0: e.clientX, y0: e.clientY, dx: 0, mode: 'pending', armed: false,
    width: row.offsetWidth, lastX: e.clientX, lastT: now, v: 0
  };
  gesture.pressTimer = setTimeout(() => { if (gesture && gesture.mode === 'pending') row.classList.add('is-pressing'); }, 110);
  gesture.longTimer = setTimeout(() => {
    if (!gesture || gesture.mode !== 'pending') return;
    gesture.mode = 'longpress';
    row.classList.remove('is-pressing');
    vibrate(15);
    suppressClicks();
    openActions(gesture.id);
  }, LONG_PRESS_MS);
  window.addEventListener('pointermove', onGestureMove, { passive: false });
  window.addEventListener('pointerup', onGestureEnd);
  window.addEventListener('pointercancel', onGestureEnd);
});

function clearGestureTimers(g) { clearTimeout(g.pressTimer); clearTimeout(g.longTimer); g.row.classList.remove('is-pressing'); }

function onGestureMove(e) {
  const g = gesture;
  if (!g || e.pointerId !== g.pointerId) return;
  const dx = e.clientX - g.x0;
  const dy = e.clientY - g.y0;

  if (g.mode === 'pending') {
    if (Math.abs(dx) > LOCK_PX && Math.abs(dx) > Math.abs(dy) * 1.3) {
      g.mode = 'swipe';
      clearGestureTimers(g);
      g.row.classList.add('is-dragging');
      try { g.card.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    } else if (Math.abs(dy) > LOCK_PX || Math.abs(dx) > LOCK_PX) {
      g.mode = 'scroll';
      clearGestureTimers(g);
      return;
    } else return;
  }
  if (g.mode !== 'swipe') return;
  e.preventDefault();

  const commit = Math.min(110, g.width * 0.3);
  let x = dx;
  if (Math.abs(x) > commit) x = Math.sign(x) * (commit + (Math.abs(x) - commit) * 0.55);
  const now = performance.now();
  g.v = (e.clientX - g.lastX) / Math.max(1, now - g.lastT);
  g.lastX = e.clientX;
  g.lastT = now;
  g.dx = dx;
  g.card.style.transform = `translate3d(${x}px,0,0)`;
  g.row.dataset.swipe = dx > 0 ? 'right' : 'left';
  g.row.style.setProperty('--sp', Math.min(1, Math.abs(dx) / commit).toFixed(3));
  const armed = Math.abs(dx) >= commit;
  if (armed !== g.armed) {
    g.armed = armed;
    g.row.classList.toggle('is-armed', armed);
    if (armed) vibrate(8);
  }
}

function onGestureEnd(e) {
  const g = gesture;
  if (!g || e.pointerId !== g.pointerId) return;
  window.removeEventListener('pointermove', onGestureMove);
  window.removeEventListener('pointerup', onGestureEnd);
  window.removeEventListener('pointercancel', onGestureEnd);
  clearGestureTimers(g);
  gesture = null;
  if (g.mode !== 'swipe') return;

  suppressClicks();
  g.row.classList.remove('is-dragging');
  const flung = Math.abs(g.dx) > 48 && Math.abs(g.v) > 0.6 && Math.sign(g.v) === Math.sign(g.dx);
  if ((g.armed || flung) && e.type !== 'pointercancel') {
    commitSwipe(g, g.dx > 0 ? 'right' : 'left');
  } else {
    g.card.style.transform = '';
    g.row.classList.remove('is-armed');
    setTimeout(() => { if (!g.row.classList.contains('is-dragging')) delete g.row.dataset.swipe; }, motion(220));
  }
}

function commitSwipe(g, dir) {
  const { row, card, id } = g;
  vibrate(12);
  row.classList.add('is-armed');
  card.style.transform = `translate3d(${dir === 'right' ? '' : '-'}${row.offsetWidth + 32}px,0,0)`;
  row.style.height = `${row.offsetHeight}px`;
  setTimeout(() => {
    row.classList.add('is-removing');
    row.style.height = '0px';
  }, motion(170));
  setTimeout(() => (dir === 'right' ? shiftTask(id) : deleteTask(id)), motion(380));
}

screen.addEventListener('contextmenu', e => {
  const row = e.target.closest('.task');
  if (!row) return;
  e.preventDefault();
  if (!openSheetEl) openActions(row.dataset.id);
});

/* ==========================================================================
   Bottom sheets
   ========================================================================== */
const appEl = $('#app');
const backdrop = $('#sheetBackdrop');
let openSheetEl = null;
let returnFocusEl = null;
const sheetHooks = {};

function openSheet(el) {
  if (openSheetEl === el) return;
  if (openSheetEl) hideSheet(openSheetEl);
  else returnFocusEl = document.activeElement;
  openSheetEl = el;
  el.removeAttribute('inert');
  el.setAttribute('aria-hidden', 'false');
  el.style.transform = '';
  void el.offsetWidth;
  el.classList.add('is-open');
  backdrop.classList.add('is-visible');
  document.documentElement.classList.add('has-sheet');
  appEl.inert = true;
  appEl.setAttribute('aria-hidden', 'true');
}
function hideSheet(el) {
  el.classList.remove('is-open', 'is-dragging');
  el.style.transform = '';
  el.setAttribute('inert', '');
  el.setAttribute('aria-hidden', 'true');
}
function closeSheet() {
  const el = openSheetEl;
  if (!el) return;
  if (el.contains(document.activeElement)) document.activeElement.blur();
  openSheetEl = null;
  const hook = sheetHooks[el.id];
  if (hook && hook.onClose) hook.onClose();
  hideSheet(el);
  backdrop.classList.remove('is-visible');
  document.documentElement.classList.remove('has-sheet');
  appEl.inert = false;
  appEl.removeAttribute('aria-hidden');
  const target = returnFocusEl && document.contains(returnFocusEl) ? returnFocusEl : null;
  returnFocusEl = null;
  if (target && target !== document.body) target.focus({ preventScroll: true });
}

// iOS only raises the keyboard when focus happens inside the tap handler. Park focus on an
// in-viewport proxy input synchronously, then hand it to the real field once the sheet is in place.
function focusInSheet(input) {
  $('#focusProxy').focus({ preventScroll: true });
  setTimeout(() => {
    if (!openSheetEl || !openSheetEl.contains(input)) return;
    input.focus({ preventScroll: true });
    const len = input.value.length;
    try { input.setSelectionRange(len, len); } catch { /* ignore */ }
  }, motion(280));
}

backdrop.addEventListener('click', closeSheet);
$$('[data-close-sheet]').forEach(b => b.addEventListener('click', closeSheet));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openSheetEl) { e.preventDefault(); closeSheet(); } });

function bindSheetDrag(sheet) {
  let d = null;
  sheet.addEventListener('pointerdown', e => {
    if (!e.target.closest('.sheet-handle, .sheet-header, .action-heading')) return;
    if (e.target.closest('button, input, textarea, select, label')) return;
    const now = performance.now();
    d = { id: e.pointerId, y0: e.clientY, dy: 0, lastY: e.clientY, lastT: now, v: 0 };
    try { sheet.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    sheet.classList.add('is-dragging');
  });
  sheet.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    const raw = e.clientY - d.y0;
    d.dy = raw > 0 ? raw : raw / 6;
    const now = performance.now();
    d.v = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    sheet.style.transform = `translate3d(0,${d.dy}px,0)`;
  });
  const end = e => {
    if (!d || e.pointerId !== d.id) return;
    const shouldClose = d.dy > 120 || (d.dy > 24 && d.v > 0.5);
    d = null;
    sheet.classList.remove('is-dragging');
    if (shouldClose && openSheetEl === sheet) closeSheet();
    else sheet.style.transform = '';
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
}
$$('.sheet').forEach(bindSheetDrag);

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
const isEnterSubmit = e => e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229;

/* Fine-pointer browsers don't open native pickers when the transparent input is clicked. */
$$('.chip-native').forEach(input => input.addEventListener('click', () => {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  try { if (input.showPicker) input.showPicker(); } catch { /* ignore */ }
}));

/* ---------- Subtask editor (shared by quick add + detail) ---------- */
function createSubtaskEditor(root, onChange = () => {}) {
  let items = [];
  const rowHTML = s => `<div class="subtask${s.done ? ' is-done' : ''}" data-sub-id="${esc(s.id)}">
    <button type="button" class="check" role="checkbox" aria-checked="${s.done}" aria-label="Hoàn thành bước">${icon('check', 'sm')}</button>
    <input class="subtask-input" type="text" value="${esc(s.name)}" aria-label="Tên bước" enterkeyhint="next" autocomplete="off" />
    <button type="button" class="icon-btn icon-btn-subtle subtask-remove" aria-label="Xóa bước">${icon('x', 'sm')}</button>
  </div>`;
  const newRowHTML = `<div class="subtask subtask-new">
    <span class="subtask-add-icon" aria-hidden="true">${icon('plus')}</span>
    <input class="subtask-input" type="text" data-new placeholder="Thêm bước" aria-label="Thêm bước mới" enterkeyhint="done" autocomplete="off" />
  </div>`;

  function set(list) {
    items = (list || []).map(s => ({ ...s, id: s.id || uid(), name: s.name || '', done: !!s.done }));
    root.innerHTML = items.map(rowHTML).join('') + newRowHTML;
    onChange();
  }
  function addFrom(input) {
    const name = input.value.trim();
    if (!name) return false;
    const s = { id: uid(), name, done: false };
    items.push(s);
    input.closest('.subtask').insertAdjacentHTML('beforebegin', rowHTML(s));
    input.value = '';
    onChange();
    return true;
  }
  root.addEventListener('click', e => {
    const row = e.target.closest('.subtask');
    const item = row && items.find(s => s.id === row.dataset.subId);
    if (!item) return;
    if (e.target.closest('.check')) {
      item.done = !item.done;
      row.classList.toggle('is-done', item.done);
      const c = $('.check', row);
      c.setAttribute('aria-checked', String(item.done));
      c.classList.remove('is-popping');
      void c.offsetWidth;
      if (item.done) c.classList.add('is-popping');
      vibrate(8);
      onChange();
    } else if (e.target.closest('.subtask-remove')) {
      items = items.filter(s => s !== item);
      row.remove();
      onChange();
    }
  });
  root.addEventListener('input', e => {
    const row = e.target.closest('.subtask');
    const item = row && items.find(s => s.id === row.dataset.subId);
    if (item) { item.name = e.target.value; onChange(); }
  });
  root.addEventListener('keydown', e => {
    if (!isEnterSubmit(e) || !e.target.matches('.subtask-input')) return;
    e.preventDefault();
    if (e.target.matches('[data-new]')) addFrom(e.target);
    else $('[data-new]', root).focus();
  });
  root.addEventListener('focusout', e => { if (e.target.matches('[data-new]')) addFrom(e.target); });

  return {
    set,
    get() {
      const pending = $('[data-new]', root);
      if (pending) addFrom(pending);
      return items.map(s => ({ ...s, name: s.name.trim() })).filter(s => s.name);
    },
    stats() {
      const named = items.filter(s => s.name.trim());
      return { done: named.filter(s => s.done).length, total: named.length };
    }
  };
}

/* ---------- Quick capture ---------- */
const quickSheet = $('#quickSheet');
const quickInput = $('#quickInput');
const quickNote = $('#quickNote');
const draft = { mode: 'task', baseDate: todayISO(), date: '', time: '', priority: 'should', manual: {}, ignoreParse: false, panel: null };
const quickSubs = createSubtaskEditor($('#quickSubtasks'), () => updateQuickUI());

function computeDraft() {
  const text = quickInput.value;
  const p = draft.ignoreParse
    ? { name: text.trim(), date: draft.baseDate, time: '', priority: 'should', detected: {} }
    : parseNatural(text, draft.baseDate, draft.manual);
  return {
    name: p.name,
    date: draft.manual.date ? draft.date : p.date,
    time: draft.manual.time ? draft.time : p.time,
    priority: draft.manual.priority ? draft.priority : p.priority,
    detected: p.detected
  };
}

function setCaptureMode(mode) {
  draft.mode = mode;
  $$('[data-capture-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.captureMode === mode)));
  quickInput.placeholder = mode === 'task' ? 'Cần làm gì?' : 'Ghi lại một ý nghĩ…';
  quickInput.setAttribute('enterkeyhint', mode === 'task' ? 'done' : 'enter');
  $('#quickHeading').textContent = mode === 'task' ? 'Thêm công việc' : 'Thêm ghi chú';
  updateQuickUI();
}

function setPanel(name) {
  const focusWasInPanel = $$('[data-panel-body]', quickSheet).some(p => !p.hidden && p.contains(document.activeElement));
  draft.panel = draft.panel === name ? null : name;
  $$('[data-panel-body]', quickSheet).forEach(p => { p.hidden = p.dataset.panelBody !== draft.panel; });
  $$('[data-panel]', quickSheet).forEach(c => c.setAttribute('aria-expanded', String(c.dataset.panel === draft.panel)));
  // Typing panels take focus straight away (inside the tap handler, so iOS keeps the keyboard up).
  if (draft.panel === 'note') quickNote.focus({ preventScroll: true });
  else if (draft.panel === 'steps') { const input = $('[data-new]', $('#quickSubtasks')); if (input) input.focus({ preventScroll: true }); }
  else if (focusWasInPanel && openSheetEl === quickSheet) quickInput.focus({ preventScroll: true });
}

function updateQuickUI() {
  const isTask = draft.mode === 'task';
  const hasText = !!quickInput.value.trim();
  $('#addQuickBtn').disabled = !hasText;
  $('#addQuickBtn').textContent = isTask ? 'Thêm việc' : 'Lưu ghi chú';
  $('#taskOptions').hidden = !isTask;
  $('#captureHint').hidden = !isTask || hasText;
  if (!isTask) { $('#parsePreview').hidden = true; return; }

  const d = computeDraft();
  const today = todayISO();

  const dateChip = $('#dateChip');
  $('.chip-label', dateChip).textContent = relativeDay(d.date);
  dateChip.classList.toggle('is-set', d.date !== today);
  $$('[data-date-preset]').forEach(b => b.classList.toggle('is-selected', addDays(today, Number(b.dataset.datePreset)) === d.date));
  const isPreset = d.date === today || d.date === addDays(today, 1);
  $('#quickDateLabel').textContent = isPreset ? 'Chọn ngày…' : longDate(d.date);
  $('#quickDate').closest('.option').classList.toggle('is-selected', !isPreset);
  $('#quickDate').value = d.date;

  $('#timeChipLabel').textContent = d.time || 'Giờ';
  $('#timeChip').classList.toggle('is-set', !!d.time);
  $('#quickTimeClear').hidden = !d.time;
  if ($('#quickTime').value !== d.time) $('#quickTime').value = d.time;

  const prioChip = $('#priorityChip');
  prioChip.dataset.p = d.priority;
  setIcon($('.prio-icon', prioChip), priorityIcon(d.priority));
  $('.chip-label', prioChip).textContent = priorityLabel(d.priority);
  prioChip.classList.toggle('is-set', d.priority !== 'should');
  $$('[data-priority-option]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.priorityOption === d.priority)));

  const st = quickSubs.stats();
  $('#noteChip').classList.toggle('is-set', !!quickNote.value.trim());
  $('#stepsChip').classList.toggle('is-set', st.total > 0);
  $('.chip-label', $('#stepsChip')).textContent = st.total ? `${st.total} bước` : 'Các bước';

  const det = d.detected || {};
  const parts = [];
  if (det.date) parts.push(relativeDay(d.date));
  if (det.time) parts.push(d.time);
  if (det.priority) parts.push(priorityLabel(d.priority));
  const preview = $('#parsePreview');
  preview.hidden = !parts.length;
  if (parts.length) {
    $('#parsePreviewText').innerHTML = `<strong>${esc(parts.join(' · '))}</strong> — “${esc(d.name)}”`;
  }
}

function openQuick({ mode, date } = {}) {
  const m = mode || (view.tab === 'notes' ? 'note' : 'task');
  const base = date && isISODate(date) ? date : todayISO();
  Object.assign(draft, { baseDate: base, date: base, time: '', priority: 'should', manual: {}, ignoreParse: false, panel: null });
  quickInput.value = '';
  quickNote.value = '';
  quickInput.style.height = '';
  quickSubs.set([]);
  setPanel(null);
  setCaptureMode(m);
  openSheet(quickSheet);
  focusInSheet(quickInput);
}

function submitQuick() {
  const text = quickInput.value.trim();
  if (!text) return;
  if (draft.mode === 'note') {
    state.notes.push({ id: uid(), text, createdAt: new Date().toISOString() });
    saveState();
    closeSheet();
    render();
    showToast('Đã lưu ghi chú');
  } else {
    const d = computeDraft();
    const task = {
      id: uid(),
      name: d.name || text,
      date: d.date,
      priority: d.priority,
      done: false,
      note: quickNote.value.trim(),
      time: d.time,
      subtasks: quickSubs.get().map(s => ({ id: s.id, name: s.name, done: s.done }))
    };
    state.tasks.unshift(task);
    newTaskId = task.id;
    saveState();
    closeSheet();
    render();
    showToast(task.date === todayISO() ? 'Đã thêm vào hôm nay' : `Đã thêm vào ${lowerFirst(relativeDay(task.date))}`);
  }
  vibrate();
}

quickInput.addEventListener('input', () => {
  if (!quickInput.value.trim()) draft.ignoreParse = false;
  autoGrow(quickInput);
  updateQuickUI();
});
quickInput.addEventListener('keydown', e => {
  if (draft.mode === 'task' && isEnterSubmit(e)) { e.preventDefault(); submitQuick(); }
});
quickNote.addEventListener('input', () => { autoGrow(quickNote); updateQuickUI(); });
$('#addQuickBtn').addEventListener('click', submitQuick);
$$('[data-capture-mode]').forEach(b => b.addEventListener('click', () => {
  setCaptureMode(b.dataset.captureMode);
  quickInput.focus({ preventScroll: true });
}));
$$('[data-panel]', quickSheet).forEach(c => c.addEventListener('click', () => setPanel(c.dataset.panel)));
$$('[data-date-preset]').forEach(b => b.addEventListener('click', () => {
  draft.date = addDays(todayISO(), Number(b.dataset.datePreset));
  draft.manual.date = true;
  setPanel(null);
  updateQuickUI();
}));
$('#quickDate').addEventListener('change', e => {
  if (!e.target.value) return;
  draft.date = e.target.value;
  draft.manual.date = true;
  setPanel(null);
  updateQuickUI();
});
$('#quickTime').addEventListener('change', e => {
  draft.time = e.target.value || '';
  draft.manual.time = true;
  updateQuickUI();
});
$('#quickTimeClear').addEventListener('click', e => {
  e.stopPropagation();
  draft.time = '';
  draft.manual.time = true;
  updateQuickUI();
});
$$('[data-priority-option]').forEach(b => b.addEventListener('click', () => {
  draft.priority = b.dataset.priorityOption;
  draft.manual.priority = true;
  setPanel(null);
  updateQuickUI();
}));
$('#parseDismiss').addEventListener('click', () => {
  draft.ignoreParse = true;
  updateQuickUI();
  quickInput.focus({ preventScroll: true });
});

$('#voiceBtn').addEventListener('click', () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Trình duyệt này chưa hỗ trợ nhập giọng nói'); return; }
  const btn = $('#voiceBtn');
  const r = new SR();
  r.lang = 'vi-VN';
  r.interimResults = false;
  r.onresult = e => {
    const said = e.results[0][0].transcript;
    quickInput.value = quickInput.value.trim() ? `${quickInput.value.trim()} ${said}` : said;
    autoGrow(quickInput);
    updateQuickUI();
  };
  r.onend = () => btn.classList.remove('is-listening');
  r.onerror = () => btn.classList.remove('is-listening');
  btn.classList.add('is-listening');
  try { r.start(); showToast('Đang nghe…'); } catch { btn.classList.remove('is-listening'); }
});

/* ---------- Task detail ---------- */
const detailSheet = $('#detailSheet');
let editingTaskId = null;
const detailDraft = { done: false, priority: 'should' };
const detailSubs = createSubtaskEditor($('#detailSubtasks'), () => {
  const st = detailSubs ? detailSubs.stats() : { total: 0, done: 0 };
  $('#detailSubCount').textContent = st.total ? `${st.done}/${st.total}` : '';
});

function setDetailDone(done) {
  detailDraft.done = done;
  $('#detailCheck').setAttribute('aria-checked', String(done));
  detailSheet.classList.toggle('is-done', done);
}
function setDetailPriority(p) {
  detailDraft.priority = p;
  detailSheet.dataset.priority = p;
  $$('#detailPriority .seg-btn').forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === p)));
}
function syncDetailTimeClear() { $('#detailTimeClear').hidden = !$('#detailTime').value; }

function openDetail(id) {
  const t = findTask(id);
  if (!t) return;
  editingTaskId = id;
  $('#detailHeading').textContent = relativeDay(t.date);
  $('#detailName').value = t.name;
  $('#detailNote').value = t.note || '';
  $('#detailDate').value = t.date;
  $('#detailTime').value = t.time || '';
  syncDetailTimeClear();
  setDetailDone(t.done);
  setDetailPriority(t.priority);
  detailSubs.set(t.subtasks || []);
  openSheet(detailSheet);
  $('.sheet-body', detailSheet).scrollTop = 0;
  requestAnimationFrame(() => { autoGrow($('#detailName')); autoGrow($('#detailNote')); });
  detailSheet.focus({ preventScroll: true });
}

function commitDetail() {
  const t = findTask(editingTaskId);
  editingTaskId = null;
  if (!t) return;
  t.name = $('#detailName').value.replace(/\s+/g, ' ').trim() || t.name;
  t.note = $('#detailNote').value.trim();
  t.priority = detailDraft.priority;
  t.date = $('#detailDate').value || todayISO();
  t.time = $('#detailTime').value || '';
  t.subtasks = detailSubs.get().map(s => ({ ...s }));
  if (t.done !== detailDraft.done) setDone(t, detailDraft.done);
  saveState();
  render();
}
sheetHooks.detailSheet = { onClose: () => { if (editingTaskId) commitDetail(); } };

$('#detailCheck').addEventListener('click', e => {
  setDetailDone(!detailDraft.done);
  const c = e.currentTarget;
  c.classList.remove('is-popping');
  void c.offsetWidth;
  if (detailDraft.done) c.classList.add('is-popping');
  vibrate(detailDraft.done ? 12 : 6);
});
$$('#detailPriority .seg-btn').forEach(b => b.addEventListener('click', () => setDetailPriority(b.dataset.value)));
$('#detailName').addEventListener('input', e => autoGrow(e.target));
$('#detailName').addEventListener('keydown', e => { if (isEnterSubmit(e)) { e.preventDefault(); e.target.blur(); } });
$('#detailNote').addEventListener('input', e => autoGrow(e.target));
$('#detailTime').addEventListener('input', syncDetailTimeClear);
$('#detailTime').addEventListener('change', syncDetailTimeClear);
$('#detailTimeClear').addEventListener('click', () => { $('#detailTime').value = ''; syncDetailTimeClear(); });
$('#saveTaskBtn').addEventListener('click', closeSheet);
$('#deleteTaskBtn').addEventListener('click', () => {
  const id = editingTaskId;
  editingTaskId = null;
  closeSheet();
  deleteTask(id);
});

/* ---------- Task actions (long press / ⋯) ---------- */
const actionSheet = $('#actionSheet');
let actionTaskId = null;

function openActions(id) {
  const t = findTask(id);
  if (!t) return;
  actionTaskId = id;
  $('#actionHeading').textContent = t.name;
  $('#actionToggleLabel').textContent = t.done ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành';
  setIcon($('#actionToggleIcon'), t.done ? 'circle' : 'check-circle');
  $('#actionShiftLabel').textContent = `Dời sang ${lowerFirst(relativeDay(shiftTarget(t)))}`;
  openSheet(actionSheet);
  actionSheet.focus({ preventScroll: true });
}
$$('[data-task-action]').forEach(b => b.addEventListener('click', () => {
  const id = actionTaskId;
  const action = b.dataset.taskAction;
  if (action === 'edit') { openDetail(id); return; }
  closeSheet();
  if (action === 'toggle') toggleTask(id);
  if (action === 'shift') shiftTask(id);
  if (action === 'delete') deleteTask(id);
}));

/* ---------- Note editor ---------- */
const noteSheet = $('#noteSheet');
let editingNoteId = null;

function openNote(id) {
  const n = state.notes.find(x => x.id === id);
  if (!n) return;
  editingNoteId = id;
  $('#noteText').value = n.text;
  const created = new Date(n.createdAt);
  $('#noteMeta').textContent = `${longDate(toISO(created))} · ${pad(created.getHours())}:${pad(created.getMinutes())}`;
  openSheet(noteSheet);
  noteSheet.focus({ preventScroll: true });
}
function removeNote(id) {
  const idx = state.notes.findIndex(n => n.id === id);
  if (idx < 0) return;
  const [removed] = state.notes.splice(idx, 1);
  saveState();
  render();
  showToast('Đã xóa ghi chú', { undo: () => { state.notes.splice(idx, 0, removed); saveState(); render(); } });
}
sheetHooks.noteSheet = {
  onClose: () => {
    const id = editingNoteId;
    editingNoteId = null;
    const n = state.notes.find(x => x.id === id);
    if (!n) return;
    const text = $('#noteText').value.trim();
    if (!text) { removeNote(id); return; }
    if (text !== n.text) { n.text = text; n.updatedAt = new Date().toISOString(); saveState(); render(); }
  }
};
$('#saveNoteBtn').addEventListener('click', closeSheet);
$('#deleteNoteBtn').addEventListener('click', () => {
  const id = editingNoteId;
  editingNoteId = null;
  closeSheet();
  removeNote(id);
});

/* ==========================================================================
   Navigation, viewport and lifecycle
   ========================================================================== */
$$('.tab').forEach(btn => btn.addEventListener('click', () => {
  if (view.tab === btn.dataset.tab) { window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); return; }
  view.tab = btn.dataset.tab;
  if (view.tab === 'calendar') { view.selectedDate = todayISO(); view.calMonth = todayISO().slice(0, 7); }
  render();
  window.scrollTo(0, 0);
  updateCompactHeader();
}));
$('#fab').addEventListener('click', () => {
  openQuick({ date: view.tab === 'calendar' ? view.selectedDate : undefined });
});

function updateCompactHeader() {
  $('#navCompact').classList.toggle('is-visible', window.scrollY > 52);
}
window.addEventListener('scroll', updateCompactHeader, { passive: true });

// Keep fixed bottom sheets above the on-screen keyboard (iOS does not resize the layout viewport).
function updateViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  const root = document.documentElement;
  root.style.setProperty('--kb', `${kb}px`);
  root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
  root.classList.toggle('kb-open', kb > 80);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateViewport);
  window.visualViewport.addEventListener('scroll', updateViewport);
  updateViewport();
}

function maybeRollover() {
  const today = todayISO();
  if (!state.lastOpened) state.lastOpened = today;
  if (state.lastOpened === today) return false;
  let moved = 0;
  state.tasks.forEach(t => { if (!t.done && t.date < today) { t.date = today; moved++; } });
  state.lastOpened = today;
  saveState();
  if (moved) setTimeout(() => showToast(`Đã chuyển ${moved} việc chưa xong sang hôm nay`), 300);
  return true;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (maybeRollover()) {
    view.selectedDate = todayISO();
    view.calMonth = todayISO().slice(0, 7);
    if (!openSheetEl) render();
  }
});

maybeRollover();
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
