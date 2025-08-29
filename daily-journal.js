// Daily Journal System
class DailyJournal {
  constructor(storage) {
    this.storage = storage;
    this.KEY_JOURNAL_ENTRIES = 'journalEntries';
    this.KEY_JOURNAL_SETTINGS = 'journalSettings';
  }

  async getJournalEntries() {
    return await this.storage.get(this.KEY_JOURNAL_ENTRIES, {});
  }

  async getJournalSettings() {
    return await this.storage.get(this.KEY_JOURNAL_SETTINGS, {
      reminderTime: '21:00',
      enabled: true,
      prompts: [
        "What did you learn today?",
        "What challenged you the most?",
        "What are you grateful for today?",
        "How did you grow today?",
        "What would you do differently?"
      ]
    });
  }

  async saveJournalEntry(date, content, prompt) {
    const entries = await this.getJournalEntries();
    
    if (!entries[date]) {
      entries[date] = [];
    }
    
    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      prompt: prompt,
      content: content.trim(),
      wordCount: content.trim().split(/\s+/).length
    };
    
    entries[date].push(entry);
    await this.storage.set(this.KEY_JOURNAL_ENTRIES, entries);
    
    if (window.analytics) {
      window.analytics.track('journal_entry_saved', { 
        wordCount: entry.wordCount,
        prompt: prompt 
      });
    }
    
    this.showJournalSavedMessage();
    await this.renderJournalEntries();
  }

  showJournalSavedMessage() {
    const messages = [
      "📓 Journal saved! आत्म-चिंतन का फल मिलेगा।",
      "✍️ Reflection recorded! विचारों की शक्ति अपार है।",
      "🌟 Thoughts captured! ज्ञान ही सच्ची संपत्ति है।",
      "📝 Entry saved! अनुभव से सीखना सबसे बड़ा गुण है।"
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    this.showToast(randomMessage, 'success');
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.className = `toast ${type} show`;
      setTimeout(() => toast.classList.remove('show'), 4000);
    }
  }

  async showDailyPrompt() {
    const settings = await this.getJournalSettings();
    if (!settings.enabled) return;
    
    const today = new Date().toISOString().split('T')[0];
    const entries = await this.getJournalEntries();
    
    // Check if already journaled today
    if (entries[today] && entries[today].length > 0) return;
    
    const randomPrompt = settings.prompts[Math.floor(Math.random() * settings.prompts.length)];
    
    // Show journal modal
    this.openJournalModal(randomPrompt);
  }

  openJournalModal(prompt = null) {
    const settings = this.getJournalSettings();
    const selectedPrompt = prompt || settings.prompts[0];
    
    const modal = document.createElement('div');
    modal.id = 'journal-modal';
    modal.className = 'journal-modal';
    modal.innerHTML = `
      <div class="journal-modal-content">
        <div class="journal-header">
          <h2>📓 Daily Reflection</h2>
          <button id="close-journal-modal" class="journal-close">×</button>
        </div>
        
        <div class="journal-prompt">
          <label for="journal-prompt-select">Today's prompt:</label>
          <select id="journal-prompt-select" class="journal-select">
            ${settings.prompts?.map(p => `
              <option value="${p}" ${p === selectedPrompt ? 'selected' : ''}>${p}</option>
            `).join('') || ''}
          </select>
        </div>
        
        <div class="journal-content">
          <textarea 
            id="journal-textarea" 
            class="journal-textarea" 
            placeholder="Write your thoughts here... Take your time to reflect."
            rows="8"
          ></textarea>
          <div class="journal-word-count">
            <span id="journal-word-count">0 words</span>
          </div>
        </div>
        
        <div class="journal-actions">
          <button id="save-journal-entry" class="journal-btn primary">Save Entry</button>
          <button id="cancel-journal" class="journal-btn secondary">Maybe Later</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.bindJournalModalEvents();
    
    // Focus on textarea
    setTimeout(() => {
      document.getElementById('journal-textarea').focus();
    }, 100);
  }

  bindJournalModalEvents() {
    const modal = document.getElementById('journal-modal');
    const textarea = document.getElementById('journal-textarea');
    const wordCount = document.getElementById('journal-word-count');
    const saveBtn = document.getElementById('save-journal-entry');
    const cancelBtn = document.getElementById('cancel-journal');
    const closeBtn = document.getElementById('close-journal-modal');
    const promptSelect = document.getElementById('journal-prompt-select');

    // Word count update
    textarea.addEventListener('input', () => {
      const words = textarea.value.trim().split(/\s+/).filter(w => w.length > 0).length;
      wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    });

    // Save entry
    saveBtn.addEventListener('click', async () => {
      const content = textarea.value.trim();
      const prompt = promptSelect.value;
      
      if (content.length < 10) {
        alert('Please write at least a few words for your reflection.');
        return;
      }
      
      const today = new Date().toISOString().split('T')[0];
      await this.saveJournalEntry(today, content, prompt);
      this.closeJournalModal();
    });

    // Cancel/close
    [cancelBtn, closeBtn].forEach(btn => {
      btn.addEventListener('click', () => this.closeJournalModal());
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal) {
        this.closeJournalModal();
      }
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeJournalModal();
      }
    });
  }

  closeJournalModal() {
    const modal = document.getElementById('journal-modal');
    if (modal) {
      modal.remove();
    }
  }

  async renderJournalEntries() {
    const entries = await this.getJournalEntries();
    const container = document.getElementById('journal-entries');
    
    if (!container) return;

    const sortedDates = Object.keys(entries).sort().reverse();
    
    if (sortedDates.length === 0) {
      container.innerHTML = `
        <div class="journal-empty">
          <p>No journal entries yet.</p>
          <button onclick="dailyJournal.openJournalModal()" class="journal-btn primary">
            Start Writing
          </button>
        </div>
      `;
      return;
    }

    let html = '<div class="journal-list">';
    
    sortedDates.slice(0, 7).forEach(date => { // Show last 7 days
      const dayEntries = entries[date];
      const formattedDate = new Date(date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short'
      });
      
      html += `
        <div class="journal-day">
          <h3 class="journal-date">${formattedDate}</h3>
          <div class="journal-day-entries">
            ${dayEntries.map(entry => `
              <div class="journal-entry">
                <div class="journal-entry-prompt">${entry.prompt}</div>
                <div class="journal-entry-content">${entry.content}</div>
                <div class="journal-entry-meta">
                  ${entry.wordCount} words • ${new Date(entry.timestamp).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Add export button
    html += `
      <div class="journal-actions-bottom">
        <button onclick="dailyJournal.exportJournal()" class="journal-btn secondary">
          📁 Export Journal
        </button>
        <button onclick="dailyJournal.openJournalModal()" class="journal-btn primary">
          ✍️ New Entry
        </button>
      </div>
    `;
    
    container.innerHTML = html;
  }

  async exportJournal() {
    const entries = await this.getJournalEntries();
    const sortedDates = Object.keys(entries).sort();
    
    let markdown = '# Daily Journal Export\n\n';
    markdown += `Exported on: ${new Date().toLocaleDateString()}\n\n`;
    
    sortedDates.forEach(date => {
      const formattedDate = new Date(date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      
      markdown += `## ${formattedDate}\n\n`;
      
      entries[date].forEach(entry => {
        markdown += `**${entry.prompt}**\n\n`;
        markdown += `${entry.content}\n\n`;
        markdown += `*${entry.wordCount} words • ${new Date(entry.timestamp).toLocaleTimeString()}*\n\n`;
        markdown += '---\n\n';
      });
    });
    
    // Download as file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lakshya-journal-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showToast('📁 Journal exported successfully!', 'success');
    
    if (window.analytics) {
      window.analytics.track('journal_exported', { 
        totalEntries: Object.values(entries).flat().length 
      });
    }
  }

  async scheduleEveningReminder() {
    const settings = await this.getJournalSettings();
    if (!settings.enabled || !settings.reminderTime) return;
    
    const now = new Date();
    const [hours, minutes] = settings.reminderTime.split(':').map(Number);
    const reminderTime = new Date();
    reminderTime.setHours(hours, minutes, 0, 0);
    
    // If reminder time has passed today, schedule for tomorrow
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }
    
    const timeUntilReminder = reminderTime.getTime() - now.getTime();
    
    setTimeout(() => {
      this.showDailyPrompt();
      // Schedule next day's reminder
      this.scheduleEveningReminder();
    }, timeUntilReminder);
  }

  async initializeJournal() {
    await this.renderJournalEntries();
    await this.scheduleEveningReminder();
  }
}

// Global daily journal instance
let dailyJournal;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof storage !== 'undefined') {
    dailyJournal = new DailyJournal(storage);
  }
});

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DailyJournal;
} else {
  window.DailyJournal = DailyJournal;
}
