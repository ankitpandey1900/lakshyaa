const storage = {
  async get(key, defaultValue) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise(resolve => chrome.storage.local.get([key], res => resolve(res[key] ?? defaultValue)));
    }
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : defaultValue; } catch { return defaultValue; }
  },
  async set(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve));
    }
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const KEY_DEADLINE = 'deadlineDate';
const KEY_TASKS_BY_DATE = 'tasksByDate';
const KEY_USERNAME = 'userName';
const KEY_DEADLINE_NOTE = 'deadlineNote';
const KEY_NOTIF_DAILY_TIME = 'notifDailyTime';
const KEY_NOTIF_DEADLINE_REMINDER = 'notifDeadlineEnabled';
const KEY_POMO = 'pomodoroSettings';
const KEY_POMO_SESSIONS = 'pomoSessionsByDate';

// Date helpers that use LOCAL dates (avoid UTC offset issues)
const toIsoLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const parseIsoLocal = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  // Use local-time constructor so the date is local midnight
  return new Date(y, m - 1, d);
};
const todayIso = () => toIsoLocal(new Date());
const formatPercent = (num) => `${Math.round(num)}%`;
function formatDateDMY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function daysUntil(dateIso) {
  if (!dateIso) return '—';
  const start = new Date(new Date().toDateString());
  const end = parseIsoLocal(dateIso) || new Date(dateIso);
  const diffMs = end - start;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
}

function getLastNDates(n) {
  const dates = [];
  const base = new Date();
  base.setHours(0,0,0,0); // normalize to local midnight
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    dates.push(toIsoLocal(d));
  }
  return dates;
}

async function readTasksByDate() { return (await storage.get(KEY_TASKS_BY_DATE, {})) || {}; }
async function writeTasksByDate(tasksByDate) { await storage.set(KEY_TASKS_BY_DATE, tasksByDate); }
function ensureArray(value) { return Array.isArray(value) ? value : []; }

// Pomodoro sessions storage
async function readPomoSessions() { return (await storage.get(KEY_POMO_SESSIONS, {})) || {}; }
async function writePomoSessions(s) { await storage.set(KEY_POMO_SESSIONS, s); }

let countdownTimer = null;

function diffCalendarUnits(fromDate, toDate) {
  // Returns {years, months, days, hours, mins, secs} using calendar math
  if (toDate <= fromDate) return { years: 0, months: 0, days: 0, hours: 0, mins: 0, secs: 0 };
  const start = new Date(fromDate);
  let years = toDate.getFullYear() - start.getFullYear();
  let months = toDate.getMonth() - start.getMonth();
  let days = toDate.getDate() - start.getDate();
  let hours = toDate.getHours() - start.getHours();
  let mins = toDate.getMinutes() - start.getMinutes();
  let secs = toDate.getSeconds() - start.getSeconds();

  if (secs < 0) { secs += 60; mins--; }
  if (mins < 0) { mins += 60; hours--; }
  if (hours < 0) { hours += 24; days--; }
  if (days < 0) {
    const temp = new Date(toDate.getFullYear(), toDate.getMonth(), 0); // last day of previous month
    days += temp.getDate();
    months--;
  }
  if (months < 0) { months += 12; years--; }
  return { years, months, days, hours, mins, secs };
}

function updateCountdown(deadlineIso) {
  const status = document.getElementById('deadline-status');
  const noteEl = document.getElementById('deadline-note');
  const y = document.getElementById('cd-years');
  const mo = document.getElementById('cd-months');
  const d = document.getElementById('cd-days');
  const h = document.getElementById('cd-hours');
  const mi = document.getElementById('cd-mins');
  const s = document.getElementById('cd-secs');
  const human = document.getElementById('countdown-human');
  if (!deadlineIso) {
    status.textContent = 'Not set';
    status.classList.remove('due-soon','overdue');
    [y,mo,d,h,mi,s].forEach(el=>el.textContent='0');
    if (human) human.textContent = 'Set a deadline to start the countdown';
    return;
  }
  // Show friendly status e.g., "Due on 30/09/2025 (35 days left)"
  const startOfToday = new Date(new Date().toDateString());
  const endDate = parseIsoLocal(deadlineIso) || new Date(deadlineIso);
  const msPerDay = 1000 * 60 * 60 * 24;
  const rawDays = Math.ceil((endDate - startOfToday) / msPerDay); // can be negative when overdue
  // Update status text and emphasis classes
  status.classList.remove('due-soon','overdue');
  if (rawDays < 0) {
    status.classList.add('overdue');
    const overdueBy = Math.abs(rawDays);
    status.textContent = `Due on ${formatDateDMY(deadlineIso)} (${overdueBy} day${overdueBy!==1?'s':''} overdue)`;
  } else {
    if (rawDays <= 7) status.classList.add('due-soon');
    status.textContent = `Due on ${formatDateDMY(deadlineIso)} (${rawDays} day${rawDays!==1?'s':''} left)`;
  }
  const tick = () => {
    const now = new Date();
    const end = parseIsoLocal(deadlineIso) || new Date(deadlineIso);
    const diff = diffCalendarUnits(now, end);
    y.textContent = String(diff.years);
    mo.textContent = String(diff.months);
    d.textContent = String(diff.days);
    h.textContent = String(diff.hours);
    mi.textContent = String(diff.mins);
    s.textContent = String(diff.secs);
    if (human) {
      const parts = [];
      if (diff.years) parts.push(`${diff.years} year${diff.years!==1?'s':''}`);
      if (diff.months) parts.push(`${diff.months} month${diff.months!==1?'s':''}`);
      if (diff.days) parts.push(`${diff.days} day${diff.days!==1?'s':''}`);
      if (diff.hours) parts.push(`${diff.hours} hour${diff.hours!==1?'s':''}`);
      if (diff.mins) parts.push(`${diff.mins} min${diff.mins!==1?'s':''}`);
      if (parts.length === 0) parts.push(`${diff.secs} sec${diff.secs!==1?'s':''}`);
      human.textContent = `${parts.slice(0,3).join(', ')} remaining`;
    }
  };
  tick();
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
}

async function renderDeadline() {
  const deadlineIso = await storage.get(KEY_DEADLINE, '');
  const note = await storage.get(KEY_DEADLINE_NOTE, '');
  const input = document.getElementById('deadline-input');
  if (deadlineIso) input.value = deadlineIso;
  const noteInput = document.getElementById('deadline-note-input');
  if (noteInput) noteInput.value = note;
  const noteDisplay = document.getElementById('deadline-note');
  if (noteDisplay) noteDisplay.textContent = note ? note : `What's the goal? e.g., Become a full stack developer`;
  const row1 = noteInput && noteInput.parentElement;
  const row2 = input && input.parentElement;
  const saveBtn = document.getElementById('save-deadline');
  if (deadlineIso) {
    if (row1) row1.style.display = 'none';
    if (row2) row2.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
  } else {
    if (row1) row1.style.display = '';
    if (row2) row2.style.display = '';
    if (saveBtn) saveBtn.style.display = '';
  }
  updateCountdown(deadlineIso);
}

async function renderToday() {
  const tasksByDate = await readTasksByDate();
  const date = todayIso();
  const list = document.getElementById('today-list');
  list.innerHTML = '';
  const tasks = ensureArray(tasksByDate[date]);
  let completed = 0;
  tasks.forEach((task, idx) => {
    if (task.done) completed++;
    const li = document.createElement('li');
    const left = document.createElement('div');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!task.done;
    const title = document.createElement('span'); title.className = 'task-title'; title.textContent = task.title; title.contentEditable = 'true'; title.spellcheck = false;
    left.className = 'row'; left.appendChild(checkbox); left.appendChild(title);
    const actions = document.createElement('div'); actions.className = 'actions';
    const del = document.createElement('button'); del.textContent = 'Delete';
    del.addEventListener('click', async () => { tasks.splice(idx,1); tasksByDate[date]=tasks; await writeTasksByDate(tasksByDate); await renderToday(); await renderBacklog(); await renderHistory(); });
    actions.appendChild(del);
    li.appendChild(left); li.appendChild(actions); list.appendChild(li);
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); }});
    title.addEventListener('blur', async () => { const newTitle = title.textContent.trim(); if (!newTitle) { title.textContent = task.title; return; } tasks[idx].title = newTitle; await writeTasksByDate(tasksByDate); showToast('Saved ✓'); });
    checkbox.addEventListener('change', async (e) => { tasks[idx].done = e.target.checked; await writeTasksByDate(tasksByDate); await renderToday(); await renderBacklog(); await renderHistory(); });
  });
  const total = tasks.length; const pct = total === 0 ? 0 : (completed / total) * 100;
  document.getElementById('progress-text').textContent = `${formatPercent(pct)} done`;
  document.getElementById('counts-text').textContent = `${completed}/${total}`;
  document.getElementById('progress-bar').style.width = `${pct}%`;
  // Refresh Pomodoro task select with today's tasks
  populatePomoTaskSelect(tasks);
}

async function renderHistory() {
  const tasksByDate = await readTasksByDate();
  const dates = getLastNDates(7);
  const ul = document.getElementById('history-list'); ul.innerHTML = '';
  dates.forEach(date => { const tasks = ensureArray(tasksByDate[date]); const done = tasks.filter(t=>t.done).length; const total = tasks.length; const li = document.createElement('li'); const left = document.createElement('div'); left.className='row'; const label=document.createElement('strong'); label.textContent=formatDateDMY(date); const pill=document.createElement('span'); pill.className='pill'; pill.textContent=`${done}/${total}`; left.appendChild(label); left.appendChild(pill); li.appendChild(left); ul.appendChild(li); });
}

function collectBacklog(tasksByDate) {
  const dates = getLastNDates(7); const cutoffSet = new Set(dates); const backlog = [];
  for (const [date, tasks] of Object.entries(tasksByDate)) { if (!cutoffSet.has(date)) continue; ensureArray(tasks).forEach((t, idx) => { if (!t.done) backlog.push({ date, index: idx, title: t.title }); }); }
  return backlog;
}

async function renderBacklog() {
  const tasksByDate = await readTasksByDate();
  const backlogItems = collectBacklog(tasksByDate);
  const ul = document.getElementById('backlog-list'); ul.innerHTML = '';
  backlogItems.sort((a,b)=>a.date<b.date?1:-1);
  backlogItems.forEach(item => {
    const li = document.createElement('li');
    const left=document.createElement('div'); left.className='row';
    const title=document.createElement('span'); title.className='task-title'; title.textContent=`${item.title} `;
    const meta=document.createElement('span'); meta.className='muted small'; meta.textContent=`(${formatDateDMY(item.date)})`;
    left.appendChild(title); left.appendChild(meta);
    const actions=document.createElement('div'); actions.className='actions';
    const toToday=document.createElement('button'); toToday.textContent='Move to Today';
    toToday.addEventListener('click', async () => { const src=ensureArray(tasksByDate[item.date]); const [task]=src.splice(item.index,1); const today=todayIso(); tasksByDate[item.date]=src; tasksByDate[today]=ensureArray(tasksByDate[today]); tasksByDate[today].push({ title: task.title, done:false }); await writeTasksByDate(tasksByDate); await refreshAll(); });
    const markDone=document.createElement('button'); markDone.textContent='Mark Done';
    markDone.addEventListener('click', async () => { const src=ensureArray(tasksByDate[item.date]); if (src[item.index]) src[item.index].done=true; await writeTasksByDate(tasksByDate); await refreshAll(); });
    actions.appendChild(toToday); actions.appendChild(markDone);
    li.appendChild(left); li.appendChild(actions); ul.appendChild(li);
  });
}

// Batch refresh helper for smoother UI updates
async function refreshAll(opts={}) {
  const { today=true, backlog=true, history=true } = opts;
  if (today) await renderToday();
  if (backlog) await renderBacklog();
  if (history) await renderHistory();
}

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  tabs.forEach(tab => tab.addEventListener('click', () => {
    const targetId = tab.dataset.tab;
    const currentPanel = document.querySelector('.tab-panel:not(.hidden)');
    const nextPanel = document.getElementById(targetId);
    if (!nextPanel || currentPanel === nextPanel) return;
    // Active tab state
    tabs.forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    // Fade out current, then swap, then fade in next
    if (currentPanel) currentPanel.classList.add('is-fading');
    setTimeout(() => {
      if (currentPanel) { currentPanel.classList.add('hidden'); currentPanel.classList.remove('is-fading'); }
      nextPanel.classList.remove('hidden');
      nextPanel.classList.add('is-fading');
      requestAnimationFrame(() => {
        // allow one frame for class to apply, then remove to trigger transition
        nextPanel.classList.remove('is-fading');
      });
    }, 120);
  }));
}

function setupActions() {
  const saveDeadlineBtn = document.getElementById('save-deadline');
  if (saveDeadlineBtn) saveDeadlineBtn.addEventListener('click', async () => {
    const value = document.getElementById('deadline-input').value;
    const note = document.getElementById('deadline-note-input').value.trim();
    await storage.set(KEY_DEADLINE, value || '');
    await storage.set(KEY_DEADLINE_NOTE, note);
    await renderDeadline();
  });
  const addTaskBtn = document.getElementById('add-task');
  if (addTaskBtn) addTaskBtn.addEventListener('click', async () => { const input=document.getElementById('task-input'); const title=(input?.value||'').trim(); if (!title) return; const date=todayIso(); const tasksByDate=await readTasksByDate(); tasksByDate[date]=ensureArray(tasksByDate[date]); tasksByDate[date].push({ title, done:false }); await writeTasksByDate(tasksByDate); if (input) input.value=''; await refreshAll(); });
  const taskInput = document.getElementById('task-input');
  if (taskInput) taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('add-task')?.click(); });
  // Quickbar: add task
  const qbAddTaskBtn = document.getElementById('qb-add-task');
  if (qbAddTaskBtn) qbAddTaskBtn.addEventListener('click', async () => {
    const input = document.getElementById('qb-task-input');
    const title = (input?.value||'').trim();
    if (!title) return;
    const date = todayIso();
    const tasksByDate = await readTasksByDate();
    tasksByDate[date] = ensureArray(tasksByDate[date]);
    tasksByDate[date].push({ title, done:false });
    await writeTasksByDate(tasksByDate);
    if (input) input.value = '';
    await refreshAll();
    showToast('Added to Today ✓');
  });
  const qbTaskInput = document.getElementById('qb-task-input');
  if (qbTaskInput) qbTaskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('qb-add-task')?.click(); });
  const clearDoneBtn = document.getElementById('clear-done');
  if (clearDoneBtn) clearDoneBtn.addEventListener('click', async () => {
    const date=todayIso(); const tasksByDate=await readTasksByDate(); const tasks=ensureArray(tasksByDate[date]);
    tasksByDate[date] = tasks.filter(t=>!t.done); await writeTasksByDate(tasksByDate);
    await refreshAll();
  });
  const moveBacklogBtn = document.getElementById('move-backlog');
  if (moveBacklogBtn) moveBacklogBtn.addEventListener('click', async () => {
    const tasksByDate=await readTasksByDate(); const backlog=collectBacklog(tasksByDate); const today=todayIso(); tasksByDate[today]=ensureArray(tasksByDate[today]);
    backlog.forEach(item => { const src=ensureArray(tasksByDate[item.date]); const task=src[item.index]; if (task && !task.done) { tasksByDate[today].push({ title: task.title, done:false }); task.done=true; } });
    await writeTasksByDate(tasksByDate); await refreshAll();
  });
  const saveNameBtn = document.getElementById('save-name');
  if (saveNameBtn) saveNameBtn.addEventListener('click', async () => {
    const input = document.getElementById('name-input');
    const name = (input?.value||'').trim();
    if (!name) return;
    showToast('Saving…');
    await storage.set(KEY_USERNAME, name);
    if (input) input.value = '';
    await renderWelcome();
    showToast('Saved ✓');
  });

  // Pomodoro controls
  const pomoStart = document.getElementById('pomo-start');
  const pomoPause = document.getElementById('pomo-pause');
  const pomoReset = document.getElementById('pomo-reset');
  if (pomoStart && pomoPause && pomoReset) {
    pomoStart.addEventListener('click', () => startPomodoro());
    pomoPause.addEventListener('click', () => pausePomodoro());
    pomoReset.addEventListener('click', () => resetPomodoro());
  }
  // Quickbar: Pomodoro controls
  const qbPomoStart = document.getElementById('qb-pomo-start');
  const qbPomoPause = document.getElementById('qb-pomo-pause');
  const qbPomoReset = document.getElementById('qb-pomo-reset');
  if (qbPomoStart) qbPomoStart.addEventListener('click', () => startPomodoro());
  if (qbPomoPause) qbPomoPause.addEventListener('click', () => pausePomodoro());
  if (qbPomoReset) qbPomoReset.addEventListener('click', () => resetPomodoro());

  // Settings drawer
  const openBtn = document.getElementById('open-settings');
  const closeBtn = document.getElementById('close-settings');
  const drawer = document.getElementById('settings-drawer');
  const backdrop = document.getElementById('backdrop');
  if (openBtn && closeBtn && drawer) {
    openBtn.addEventListener('click', async () => {
      // preload current values
      document.getElementById('stg-name').value = await storage.get(KEY_USERNAME, '') || '';
      document.getElementById('stg-goal').value = await storage.get(KEY_DEADLINE_NOTE, '') || '';
      document.getElementById('stg-deadline').value = await storage.get(KEY_DEADLINE, '') || '';
      document.getElementById('stg-daily-time').value = await storage.get(KEY_NOTIF_DAILY_TIME, '') || '';
      document.getElementById('stg-deadline-rem').checked = !!(await storage.get(KEY_NOTIF_DEADLINE_REMINDER, false));
      const ps = await storage.get(KEY_POMO, {});
      document.getElementById('stg-pomo-focus').value = ps.focusMin ?? 25;
      document.getElementById('stg-pomo-break').value = ps.breakMin ?? 5;
      document.getElementById('stg-pomo-auto').checked = ps.autoCycle ?? true;
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden','false');
      if (backdrop) { backdrop.classList.add('show'); backdrop.setAttribute('aria-hidden','false'); }
    });
    const closeDrawer = () => {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden','true');
      if (backdrop) { backdrop.classList.remove('show'); backdrop.setAttribute('aria-hidden','true'); }
    };
    closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });
  }

  const saveName = document.getElementById('stg-save-name');
  if (saveName) {
    saveName.addEventListener('click', async () => {
      const name = (document.getElementById('stg-name').value||'').trim();
      showToast('Saving…');
      await storage.set(KEY_USERNAME, name);
      await renderWelcome();
      showToast('Saved ✓');
    });
  }
  const saveDeadline = document.getElementById('stg-save-deadline');
  if (saveDeadline) {
    saveDeadline.addEventListener('click', async () => {
      const date = document.getElementById('stg-deadline').value;
      const goal = document.getElementById('stg-goal').value.trim();
      showToast('Saving…');
      await storage.set(KEY_DEADLINE, date || '');
      await storage.set(KEY_DEADLINE_NOTE, goal);
      await renderDeadline();
      showToast('Saved ✓');
    });
  }
  const saveNotif = document.getElementById('stg-save-notif');
  if (saveNotif) {
    saveNotif.addEventListener('click', async () => {
      const timeStr = document.getElementById('stg-daily-time').value;
      const enabled = document.getElementById('stg-deadline-rem').checked;
      showToast('Saving…');
      await storage.set(KEY_NOTIF_DAILY_TIME, timeStr || '');
      await storage.set(KEY_NOTIF_DEADLINE_REMINDER, enabled);
      showToast('Saved ✓');
    });
  }
  const savePomo = document.getElementById('stg-save-pomo');
  if (savePomo) {
    savePomo.addEventListener('click', async () => {
      const focusMin = parseInt(document.getElementById('stg-pomo-focus').value || '25', 10);
      const breakMin = parseInt(document.getElementById('stg-pomo-break').value || '5', 10);
      const autoCycle = document.getElementById('stg-pomo-auto').checked;
      pomoState.focusMin = Math.max(1, focusMin);
      pomoState.breakMin = Math.max(1, breakMin);
      pomoState.autoCycle = autoCycle;
      pomoState.remainingSec = (pomoState.mode==='focus'?pomoState.focusMin: pomoState.breakMin)*60;
      await storage.set(KEY_POMO, pomoState);
      updatePomoUI();
      showToast('Saved ✓');
    });
  }
}

async function renderWelcome() {
  const name = await storage.get(KEY_USERNAME, '');
  const text = document.getElementById('welcome-text');
  const input = document.getElementById('name-input');
  const saveBtn = document.getElementById('save-name');
  if (name) {
    if (text) text.textContent = `Welcome ${name}. Let's Achieve More!`;
    if (input && input.parentElement) input.parentElement.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
  } else {
    if (text) text.textContent = `Welcome. Let's Achieve More!`;
    if (input && input.parentElement) input.parentElement.style.display = '';
    if (saveBtn) saveBtn.style.display = '';
  }
}

// Pomodoro logic
let pomoTimer = null;
let pomoState = { mode: 'focus', remainingSec: 25*60, running: false, focusMin: 25, breakMin: 5, autoCycle: true, currentFocusStart: null, linkedTask: '' };

async function loadPomodoro() {
  const saved = await storage.get(KEY_POMO, null);
  if (saved) pomoState = { ...pomoState, ...saved };
  updatePomoUI();
  // Try to reflect linked task into selector after load
  populatePomoTaskSelect();
}

function updatePomoUI() {
  const t = document.getElementById('pomo-time');
  const m = document.getElementById('pomo-mode');
  if (!t || !m) return;
  const mins = Math.floor(pomoState.remainingSec/60).toString().padStart(2,'0');
  const secs = (pomoState.remainingSec%60).toString().padStart(2,'0');
  t.textContent = `${mins}:${secs}`;
  const modeText = pomoState.mode === 'focus' ? 'Focus' : 'Break';
  m.textContent = modeText;
  const ring = document.querySelector('.pomo .ring');
  if (ring) {
    const total = (pomoState.mode==='focus'?pomoState.focusMin: pomoState.breakMin)*60;
    const progress = 360 * (1 - (pomoState.remainingSec/total));
    ring.style.background = `conic-gradient(var(--accent) ${progress}deg, #253041 0deg)`;
  }
  applyPomoClasses();
  // Update quickbar mirrored timer (if present)
  const qt = document.getElementById('qb-pomo-time');
  const qm = document.getElementById('qb-pomo-mode');
  if (qt) qt.textContent = `${mins}:${secs}`;
  if (qm) qm.textContent = modeText;
}

function applyPomoClasses() {
  const container = document.querySelector('.pomo');
  if (!container) return;
  container.classList.toggle('running', !!pomoState.running);
  container.classList.toggle('focus', pomoState.mode === 'focus');
  container.classList.toggle('break', pomoState.mode === 'break');
}

function tickPomodoro() {
  if (!pomoState.running) return;
  if (pomoState.remainingSec > 0) {
    pomoState.remainingSec -= 1;
    updatePomoUI();
  } else {
    // Switch mode
    if (pomoState.mode === 'focus') {
      // Focus session finished
      logEndFocusSession('completed');
      pomoState.mode = 'break';
      pomoState.remainingSec = pomoState.breakMin*60;
    } else {
      pomoState.mode = 'focus';
      pomoState.remainingSec = pomoState.focusMin*60;
      // New focus session starts immediately if running
      if (pomoState.running) logStartFocusSession();
    }
    storage.set(KEY_POMO, pomoState);
    updatePomoUI();
    if (!pomoState.autoCycle) pausePomodoro();
  }
}

function startPomodoro() {
  if (pomoTimer) clearInterval(pomoTimer);
  pomoState.running = true;
  pomoTimer = setInterval(tickPomodoro, 1000);
  // Start a focus session timer if entering/being in focus mode
  // Capture currently selected task to link this session
  const sel = document.getElementById('pomo-task-select');
  if (sel) {
    const value = sel.value || '';
    pomoState.linkedTask = value;
  }
  if (pomoState.mode === 'focus' && !pomoState.currentFocusStart) {
    logStartFocusSession();
  }
  storage.set(KEY_POMO, pomoState);
  updatePomoUI();
}
function pausePomodoro() {
  pomoState.running = false;
  if (pomoTimer) clearInterval(pomoTimer);
  storage.set(KEY_POMO, pomoState);
  updatePomoUI();
}
function resetPomodoro() {
  pomoState.running = false;
  if (pomoTimer) clearInterval(pomoTimer);
  // If resetting during an active focus session, end it early
  if (pomoState.mode === 'focus' && pomoState.currentFocusStart) {
    logEndFocusSession('reset');
  }
  pomoState.remainingSec = (pomoState.mode==='focus'?pomoState.focusMin: pomoState.breakMin)*60;
  storage.set(KEY_POMO, pomoState);
  updatePomoUI();
}

// === Pomodoro session logging ===
function logStartFocusSession() {
  pomoState.currentFocusStart = Date.now();
  storage.set(KEY_POMO, pomoState);
}

async function logEndFocusSession(reason) {
  if (!pomoState.currentFocusStart) return;
  const startMs = pomoState.currentFocusStart;
  const endMs = Date.now();
  const durationSec = Math.max(1, Math.round((endMs - startMs) / 1000));
  const date = todayIso();
  const sessions = await readPomoSessions();
  sessions[date] = ensureArray(sessions[date]);
  sessions[date].push({ start: startMs, end: endMs, durationSec, reason, taskTitle: pomoState.linkedTask || null });
  await writePomoSessions(sessions);
  pomoState.currentFocusStart = null;
  await storage.set(KEY_POMO, pomoState);
  renderPomoLog();
}

function fmtTimeHM(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDurHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function renderPomoLog() {
  const sessionsByDate = await readPomoSessions();
  const today = todayIso();
  const list = ensureArray(sessionsByDate[today]);
  const ul = document.getElementById('pomo-log');
  const summary = document.getElementById('pomo-summary');
  if (!ul || !summary) return;
  ul.innerHTML = '';
  let total = 0;
  list.forEach((s) => { total += s.durationSec; });
  const totalH = Math.floor(total / 3600);
  const totalM = Math.floor((total % 3600) / 60);
  const totalStr = total > 0 ? `${totalH}h ${totalM}m` : '0m';
  summary.textContent = `Today: ${list.length} session${list.length!==1?'s':''}, total ${totalStr}`;
  list
    .slice()
    .sort((a,b)=>a.start-b.start)
    .forEach(s => {
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.className = 'row';
      const title = document.createElement('span');
      title.className = 'task-title';
      title.textContent = `${fmtTimeHM(s.start)} - ${fmtTimeHM(s.end)}`;
      const meta = document.createElement('span');
      meta.className = 'muted small';
      const taskStr = s.taskTitle ? ` • Task: ${s.taskTitle}` : '';
      meta.textContent = ` (${fmtDurHMS(s.durationSec)})${taskStr}`;
      left.appendChild(title);
      left.appendChild(meta);
      li.appendChild(left);
      ul.appendChild(li);
    });
}

// Populate the Pomodoro task selector with today's tasks
async function populatePomoTaskSelect(preloadedTasks) {
  try {
    const sel = document.getElementById('pomo-task-select');
    if (!sel) return;
    const tasks = preloadedTasks ?? ensureArray((await readTasksByDate())[todayIso()]);
    sel.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— None —';
    sel.appendChild(none);
    tasks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.title;
      opt.textContent = t.title;
      sel.appendChild(opt);
    });
    if (pomoState.linkedTask) sel.value = pomoState.linkedTask;
  } catch {}
}

async function init() { setupTabs(); setupActions(); await renderWelcome(); await renderDeadline(); await renderToday(); await renderHistory(); await renderBacklog(); await loadPomodoro(); await renderPomoLog(); await populatePomoTaskSelect(); }
document.addEventListener('DOMContentLoaded', init);

// Toast helper
let toastTimer;
function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove('show'), 1200);
}


// Finalize in-flight focus session if page is hidden/closed
function finalizeInFlightSession() {
  try {
    if (pomoState && pomoState.mode === 'focus' && pomoState.currentFocusStart) {
      // Best-effort; no await to avoid blocking unload
      logEndFocusSession('abandoned');
    }
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') finalizeInFlightSession();
});
window.addEventListener('beforeunload', finalizeInFlightSession);


