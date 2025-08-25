// Background service worker for alarms/notifications
const KEY_DEADLINE = 'deadlineDate';
const KEY_USERNAME = 'userName';
const KEY_NOTIF_DAILY_TIME = 'notifDailyTime'; // 'HH:MM' 24h
const KEY_NOTIF_DEADLINE_REMINDER = 'notifDeadlineEnabled'; // boolean

function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

function scheduleDailySummary(timeStr) {
  chrome.alarms.clear('daily-summary');
  if (!timeStr) return;
  const [hh, mm] = timeStr.split(':').map(Number);
  const now = new Date();
  const when = new Date();
  when.setHours(hh, mm, 0, 0);
  if (when <= now) when.setDate(when.getDate() + 1);
  chrome.alarms.create('daily-summary', { when: when.getTime(), periodInMinutes: 24 * 60 });
}

function scheduleDeadlineReminder(deadlineIso) {
  chrome.alarms.clear('deadline-reminder');
  if (!deadlineIso) return;
  const when = new Date(deadlineIso).getTime();
  if (when > Date.now()) chrome.alarms.create('deadline-reminder', { when });
}

async function initializeSchedules() {
  const { [KEY_NOTIF_DAILY_TIME]: timeStr, [KEY_DEADLINE]: deadlineIso, [KEY_NOTIF_DEADLINE_REMINDER]: enabled } = await getStorage([KEY_NOTIF_DAILY_TIME, KEY_DEADLINE, KEY_NOTIF_DEADLINE_REMINDER]);
  if (timeStr) scheduleDailySummary(timeStr);
  if (enabled) scheduleDeadlineReminder(deadlineIso);
}

chrome.runtime.onInstalled.addListener(() => { initializeSchedules(); });
chrome.runtime.onStartup.addListener(() => { initializeSchedules(); });

// Open full-page UI on icon click
chrome.action.onClicked.addListener(() => {
  const url = chrome.runtime.getURL('newtab.html');
  chrome.tabs.create({ url });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const { [KEY_USERNAME]: name, [KEY_DEADLINE]: deadlineIso } = await getStorage([KEY_USERNAME, KEY_DEADLINE]);
  if (alarm.name === 'daily-summary') {
    chrome.notifications.create({
      type: 'basic', iconUrl: 'icon.png', title: 'Daily Summary', message: `Let's Achieve More${name ? ', ' + name : ''}! Open a new tab to plan today.`, priority: 1
    });
  }
  if (alarm.name === 'deadline-reminder' && deadlineIso) {
    chrome.notifications.create({
      type: 'basic', iconUrl: 'icon.png', title: 'Deadline reached', message: 'Your deadline is now. Review your goals.', priority: 2
    });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[KEY_NOTIF_DAILY_TIME]) scheduleDailySummary(changes[KEY_NOTIF_DAILY_TIME].newValue);
  if (changes[KEY_DEADLINE] || changes[KEY_NOTIF_DEADLINE_REMINDER]) {
    const deadlineIso = (changes[KEY_DEADLINE]?.newValue) ?? undefined;
    const enabled = (changes[KEY_NOTIF_DEADLINE_REMINDER]?.newValue);
    if (enabled) scheduleDeadlineReminder(deadlineIso);
    else chrome.alarms.clear('deadline-reminder');
  }
});


