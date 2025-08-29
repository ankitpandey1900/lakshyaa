// Smart Task Suggestions System
class SmartSuggestions {
  constructor(storage) {
    this.storage = storage;
    this.KEY_TASK_PATTERNS = 'taskPatterns';
    this.KEY_SUGGESTION_HISTORY = 'suggestionHistory';
  }

  async analyzeTaskPatterns() {
    const tasksByDate = await this.storage.get('tasksByDate', {});
    const patterns = {
      dayOfWeekPreferences: {},
      neglectedTasks: [],
      commonKeywords: {},
      timeBasedPatterns: {}
    };

    // Analyze day-of-week patterns
    Object.entries(tasksByDate).forEach(([dateStr, tasks]) => {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      if (!patterns.dayOfWeekPreferences[dayOfWeek]) {
        patterns.dayOfWeekPreferences[dayOfWeek] = {};
      }

      tasks.forEach(task => {
        const keywords = this.extractKeywords(task.text);
        keywords.forEach(keyword => {
          patterns.dayOfWeekPreferences[dayOfWeek][keyword] = 
            (patterns.dayOfWeekPreferences[dayOfWeek][keyword] || 0) + 1;
          patterns.commonKeywords[keyword] = 
            (patterns.commonKeywords[keyword] || 0) + 1;
        });
      });
    });

    await this.storage.set(this.KEY_TASK_PATTERNS, patterns);
    return patterns;
  }

  extractKeywords(text) {
    // Simple keyword extraction
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .slice(0, 3); // Top 3 keywords
  }

  async getBacklogTasks() {
    const tasksByDate = await this.storage.get('tasksByDate', {});
    const backlogTasks = [];
    const today = new Date();
    const cutoffDate = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago

    Object.entries(tasksByDate).forEach(([dateStr, tasks]) => {
      const taskDate = new Date(dateStr);
      if (taskDate >= cutoffDate && taskDate < today) {
        const incompleteTasks = tasks.filter(task => !task.done);
        incompleteTasks.forEach(task => {
          const daysOld = Math.floor((today - taskDate) / (24 * 60 * 60 * 1000));
          backlogTasks.push({
            ...task,
            originalDate: dateStr,
            daysOld,
            karma: this.calculateKarma(task, daysOld)
          });
        });
      }
    });

    return backlogTasks.sort((a, b) => b.karma - a.karma);
  }

  calculateKarma(task, daysOld) {
    let karma = daysOld * 10; // Base karma from age
    
    // Boost karma for certain keywords
    const urgentKeywords = ['urgent', 'important', 'deadline', 'submit', 'review', 'call', 'email'];
    const keywords = this.extractKeywords(task.text);
    
    urgentKeywords.forEach(urgentWord => {
      if (keywords.some(keyword => keyword.includes(urgentWord))) {
        karma += 25;
      }
    });

    // Boost karma for longer tasks (likely more important)
    if (task.text.length > 30) karma += 15;
    
    return karma;
  }

  async generateSuggestions() {
    const patterns = await this.analyzeTaskPatterns();
    const backlogTasks = await this.getBacklogTasks();
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    const suggestions = {
      dayBased: [],
      neglected: [],
      karma: []
    };

    // Day-based suggestions
    const dayPreferences = patterns.dayOfWeekPreferences[dayOfWeek] || {};
    const topKeywords = Object.entries(dayPreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([keyword]) => keyword);

    if (topKeywords.length > 0) {
      suggestions.dayBased.push({
        type: 'day-pattern',
        message: `Based on your ${this.getDayName(dayOfWeek)} patterns, consider tasks related to: ${topKeywords.join(', ')}`,
        keywords: topKeywords
      });
    }

    // High karma (neglected) tasks
    const highKarmaTasks = backlogTasks.slice(0, 3);
    suggestions.karma = highKarmaTasks.map(task => ({
      type: 'high-karma',
      task: task.text,
      karma: task.karma,
      daysOld: task.daysOld,
      message: `⚡ High karma task (${task.karma} points, ${task.daysOld} days old)`
    }));

    // Most neglected task types
    const taskTypes = {};
    backlogTasks.forEach(task => {
      const keywords = this.extractKeywords(task.text);
      keywords.forEach(keyword => {
        taskTypes[keyword] = (taskTypes[keyword] || 0) + task.karma;
      });
    });

    const neglectedTypes = Object.entries(taskTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2);

    suggestions.neglected = neglectedTypes.map(([type, totalKarma]) => ({
      type: 'neglected-category',
      category: type,
      karma: totalKarma,
      message: `🧹 Consider catching up on "${type}" tasks (${Math.round(totalKarma)} karma points)`
    }));

    await this.storage.set(this.KEY_SUGGESTION_HISTORY, {
      date: today.toISOString(),
      suggestions
    });

    return suggestions;
  }

  getDayName(dayIndex) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex];
  }

  async displaySuggestions() {
    const suggestions = await this.generateSuggestions();
    const suggestionContainer = document.getElementById('smart-suggestions');
    
    if (!suggestionContainer) return;

    let html = '<h3>💡 Smart Suggestions</h3>';

    // Day-based suggestions
    if (suggestions.dayBased.length > 0) {
      html += '<div class="suggestion-group">';
      suggestions.dayBased.forEach(suggestion => {
        html += `<div class="suggestion day-suggestion">${suggestion.message}</div>`;
      });
      html += '</div>';
    }

    // High karma tasks
    if (suggestions.karma.length > 0) {
      html += '<div class="suggestion-group">';
      html += '<h4>🔥 High Priority Backlog</h4>';
      suggestions.karma.forEach(suggestion => {
        html += `
          <div class="suggestion karma-suggestion" data-task="${suggestion.task}">
            <div class="suggestion-text">${suggestion.task}</div>
            <div class="suggestion-meta">${suggestion.message}</div>
            <button class="add-suggested-task" onclick="addSuggestedTask('${suggestion.task}')">Add Today</button>
          </div>
        `;
      });
      html += '</div>';
    }

    // Neglected categories
    if (suggestions.neglected.length > 0) {
      html += '<div class="suggestion-group">';
      suggestions.neglected.forEach(suggestion => {
        html += `<div class="suggestion neglected-suggestion">${suggestion.message}</div>`;
      });
      html += '</div>';
    }

    suggestionContainer.innerHTML = html;
  }

  async initializeSuggestions() {
    await this.displaySuggestions();
  }
}

// Global function to add suggested tasks
function addSuggestedTask(taskText) {
  const taskInput = document.getElementById('task-input');
  if (taskInput) {
    taskInput.value = taskText;
    const addButton = document.getElementById('add-task');
    if (addButton) {
      addButton.click();
    }
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartSuggestions;
} else {
  window.SmartSuggestions = SmartSuggestions;
}
