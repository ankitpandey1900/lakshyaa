// Export & Backup System
class ExportBackup {
  constructor(storage) {
    this.storage = storage;
    this.KEY_BACKUP_SETTINGS = 'backupSettings';
    this.KEY_LAST_BACKUP = 'lastBackupDate';
  }

  async getBackupSettings() {
    return await this.storage.get(this.KEY_BACKUP_SETTINGS, {
      autoReminder: true,
      reminderInterval: 7, // days
      includeJournal: true,
      includePomoSessions: true,
      includeTasks: true,
      includeStreaks: true
    });
  }

  async getAllUserData() {
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      userData: {}
    };

    // Get all stored data
    const keys = [
      'deadlineDate',
      'deadlineNote', 
      'userName',
      'tasksByDate',
      'pomodoroSettings',
      'pomoSessionsByDate',
      'streakData',
      'lastActivityDate',
      'miniGoals',
      'journalEntries',
      'journalSettings',
      'taskPatterns',
      'suggestionHistory',
      'notifDailyTime',
      'notifDeadlineEnabled'
    ];

    for (const key of keys) {
      data.userData[key] = await this.storage.get(key, null);
    }

    return data;
  }

  async exportAsJSON() {
    const data = await this.getAllUserData();
    const jsonString = JSON.stringify(data, null, 2);
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lakshya-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await this.storage.set(this.KEY_LAST_BACKUP, new Date().toISOString());
    
    this.showToast('📁 Complete backup exported successfully!', 'success');
    
    if (window.analytics) {
      window.analytics.track('data_exported', { format: 'json' });
    }
  }

  async exportAsMarkdown() {
    const data = await this.getAllUserData();
    let markdown = '# Lakshya Data Export\n\n';
    markdown += `Exported on: ${new Date().toLocaleDateString()}\n\n`;

    // User Profile
    if (data.userData.userName) {
      markdown += `## User Profile\n\n`;
      markdown += `**Name:** ${data.userData.userName}\n\n`;
    }

    // Deadline
    if (data.userData.deadlineDate) {
      markdown += `## Main Deadline\n\n`;
      markdown += `**Goal:** ${data.userData.deadlineNote || 'Not specified'}\n`;
      markdown += `**Target Date:** ${data.userData.deadlineDate}\n\n`;
    }

    // Mini Goals
    if (data.userData.miniGoals && data.userData.miniGoals.length > 0) {
      markdown += `## Mini Goals\n\n`;
      data.userData.miniGoals.forEach(goal => {
        const status = goal.completed ? '✅' : '⏳';
        markdown += `${status} ${goal.text}`;
        if (goal.targetDate) markdown += ` (Target: ${goal.targetDate})`;
        markdown += '\n';
      });
      markdown += '\n';
    }

    // Tasks by Date
    if (data.userData.tasksByDate) {
      markdown += `## Tasks History\n\n`;
      const sortedDates = Object.keys(data.userData.tasksByDate).sort().reverse();
      
      sortedDates.slice(0, 30).forEach(date => { // Last 30 days
        const tasks = data.userData.tasksByDate[date];
        if (tasks.length > 0) {
          markdown += `### ${new Date(date).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })}\n\n`;
          
          tasks.forEach(task => {
            const status = task.done ? '✅' : '⏳';
            markdown += `${status} ${task.text}\n`;
          });
          markdown += '\n';
        }
      });
    }

    // Pomodoro Sessions
    if (data.userData.pomoSessionsByDate) {
      markdown += `## Focus Sessions\n\n`;
      const sortedDates = Object.keys(data.userData.pomoSessionsByDate).sort().reverse();
      
      sortedDates.slice(0, 14).forEach(date => { // Last 14 days
        const sessions = data.userData.pomoSessionsByDate[date];
        if (sessions.length > 0) {
          const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
          markdown += `**${new Date(date).toLocaleDateString()}:** ${sessions.length} sessions, ${Math.round(totalMinutes)} minutes\n`;
        }
      });
      markdown += '\n';
    }

    // Streaks
    if (data.userData.streakData) {
      markdown += `## Streak Statistics\n\n`;
      markdown += `**Current Task Streak:** ${data.userData.streakData.taskStreak} days\n`;
      markdown += `**Best Task Streak:** ${data.userData.streakData.maxTaskStreak} days\n`;
      markdown += `**Focus Sessions:** ${data.userData.streakData.pomoStreak}\n\n`;
    }

    // Journal Entries
    if (data.userData.journalEntries) {
      markdown += `## Journal Entries\n\n`;
      const sortedDates = Object.keys(data.userData.journalEntries).sort().reverse();
      
      sortedDates.slice(0, 14).forEach(date => { // Last 14 days
        const entries = data.userData.journalEntries[date];
        if (entries.length > 0) {
          markdown += `### ${new Date(date).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })}\n\n`;
          
          entries.forEach(entry => {
            markdown += `**${entry.prompt}**\n\n`;
            markdown += `${entry.content}\n\n`;
            markdown += `*${entry.wordCount} words*\n\n---\n\n`;
          });
        }
      });
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lakshya-export-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('📝 Markdown export completed!', 'success');
    
    if (window.analytics) {
      window.analytics.track('data_exported', { format: 'markdown' });
    }
  }

  async importFromJSON(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.userData) {
        throw new Error('Invalid backup file format');
      }

      // Confirm import
      const confirmed = confirm(
        'This will overwrite your current data. Are you sure you want to import this backup?'
      );
      
      if (!confirmed) return;

      // Import all data
      for (const [key, value] of Object.entries(data.userData)) {
        if (value !== null) {
          await this.storage.set(key, value);
        }
      }

      this.showToast('✅ Data imported successfully! Please refresh the page.', 'success');
      
      // Refresh page after short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
      if (window.analytics) {
        window.analytics.track('data_imported');
      }
      
    } catch (error) {
      console.error('Import error:', error);
      this.showToast('❌ Import failed. Please check the file format.', 'error');
    }
  }

  async checkBackupReminder() {
    const settings = await this.getBackupSettings();
    if (!settings.autoReminder) return;

    const lastBackup = await this.storage.get(this.KEY_LAST_BACKUP, null);
    
    if (!lastBackup) {
      // First time user - show backup info after 3 days
      const installDate = await this.storage.get('installDate', new Date().toISOString());
      const daysSinceInstall = (new Date() - new Date(installDate)) / (1000 * 60 * 60 * 24);
      
      if (daysSinceInstall >= 3) {
        this.showBackupReminder(true);
      }
      return;
    }

    const daysSinceBackup = (new Date() - new Date(lastBackup)) / (1000 * 60 * 60 * 24);
    
    if (daysSinceBackup >= settings.reminderInterval) {
      this.showBackupReminder(false);
    }
  }

  showBackupReminder(isFirstTime = false) {
    const message = isFirstTime 
      ? "💾 Backup your Lakshya data to keep your progress safe!"
      : "⏰ It's been a week since your last backup. Keep your data safe!";
    
    const modal = document.createElement('div');
    modal.className = 'backup-reminder-modal';
    modal.innerHTML = `
      <div class="backup-reminder-content">
        <h3>💾 Backup Reminder</h3>
        <p>${message}</p>
        <div class="backup-reminder-actions">
          <button onclick="exportBackup.exportAsJSON()" class="backup-btn primary">
            Backup Now
          </button>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" class="backup-btn secondary">
            Later
          </button>
          <button onclick="exportBackup.disableReminders()" class="backup-btn text">
            Don't remind me
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (modal.parentElement) {
        modal.remove();
      }
    }, 10000);
  }

  async disableReminders() {
    const settings = await this.getBackupSettings();
    settings.autoReminder = false;
    await this.storage.set(this.KEY_BACKUP_SETTINGS, settings);
    
    const modal = document.querySelector('.backup-reminder-modal');
    if (modal) modal.remove();
    
    this.showToast('Backup reminders disabled', 'info');
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.className = `toast ${type} show`;
      setTimeout(() => toast.classList.remove('show'), 4000);
    }
  }

  renderExportOptions() {
    const container = document.getElementById('export-options');
    if (!container) return;

    container.innerHTML = `
      <div class="export-section">
        <h3>📁 Export & Backup</h3>
        
        <div class="export-options">
          <button onclick="exportBackup.exportAsJSON()" class="export-btn primary">
            💾 Complete Backup (JSON)
          </button>
          <button onclick="exportBackup.exportAsMarkdown()" class="export-btn secondary">
            📝 Readable Export (Markdown)
          </button>
        </div>
        
        <div class="import-section">
          <h4>Import Data</h4>
          <input type="file" id="import-file" accept=".json" style="display: none;">
          <button onclick="document.getElementById('import-file').click()" class="export-btn secondary">
            📂 Import Backup
          </button>
        </div>
        
        <div class="backup-info">
          <small>💡 Regular backups keep your progress safe. JSON format preserves all data, Markdown is human-readable.</small>
        </div>
      </div>
    `;

    // Bind import file handler
    const fileInput = document.getElementById('import-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.importFromJSON(file);
        }
      });
    }
  }

  async initializeExportBackup() {
    this.renderExportOptions();
    
    // Set install date if not exists
    const installDate = await this.storage.get('installDate', null);
    if (!installDate) {
      await this.storage.set('installDate', new Date().toISOString());
    }
    
    // Check for backup reminder
    setTimeout(() => {
      this.checkBackupReminder();
    }, 5000); // Check after 5 seconds
  }
}

// Global export backup instance
let exportBackup;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof storage !== 'undefined') {
    exportBackup = new ExportBackup(storage);
  }
});

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportBackup;
} else {
  window.ExportBackup = ExportBackup;
}
