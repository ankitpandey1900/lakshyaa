// Mini Goals Tracker System
class MiniGoalsManager {
  constructor(storage) {
    this.storage = storage;
    this.KEY_MINI_GOALS = 'miniGoals';
  }

  async getMiniGoals() {
    return await this.storage.get(this.KEY_MINI_GOALS, []);
  }

  async addMiniGoal(text, targetDate = null) {
    const goals = await this.getMiniGoals();
    const newGoal = {
      id: Date.now().toString(),
      text: text.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      targetDate: targetDate,
      completedAt: null
    };
    
    goals.push(newGoal);
    await this.storage.set(this.KEY_MINI_GOALS, goals);
    await this.renderMiniGoals();
    
    if (window.analytics) {
      window.analytics.track('mini_goal_added', { goalText: text });
    }
    
    return newGoal;
  }

  async toggleMiniGoal(goalId) {
    const goals = await this.getMiniGoals();
    const goal = goals.find(g => g.id === goalId);
    
    if (!goal) return;
    
    goal.completed = !goal.completed;
    goal.completedAt = goal.completed ? new Date().toISOString() : null;
    
    await this.storage.set(this.KEY_MINI_GOALS, goals);
    await this.renderMiniGoals();
    
    if (goal.completed) {
      this.showGoalCompletionCelebration(goal.text);
    }
    
    if (window.analytics) {
      window.analytics.track('mini_goal_toggled', { completed: goal.completed });
    }
  }

  async deleteMiniGoal(goalId) {
    const goals = await this.getMiniGoals();
    const filteredGoals = goals.filter(g => g.id !== goalId);
    
    await this.storage.set(this.KEY_MINI_GOALS, filteredGoals);
    await this.renderMiniGoals();
  }

  showGoalCompletionCelebration(goalText) {
    const celebrations = [
      "🎉 Mini goal achieved! लक्ष्य की ओर एक कदम और!",
      "✨ Well done! हर छोटी जीत बड़ी सफलता की नींव है!",
      "🏆 Goal completed! अभ्यास से सिद्धि मिलती है!",
      "🌟 Excellent progress! धैर्य और मेहनत का फल मिला!"
    ];
    
    const randomCelebration = celebrations[Math.floor(Math.random() * celebrations.length)];
    this.showToast(randomCelebration, 'success');
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.className = `toast ${type} show`;
      setTimeout(() => toast.classList.remove('show'), 4000);
    }
  }

  calculateProgress() {
    return this.getMiniGoals().then(goals => {
      if (goals.length === 0) return 0;
      const completed = goals.filter(g => g.completed).length;
      return Math.round((completed / goals.length) * 100);
    });
  }

  async renderMiniGoals() {
    const goals = await this.getMiniGoals();
    const container = document.getElementById('mini-goals-list');
    
    if (!container) return;

    if (goals.length === 0) {
      container.innerHTML = '<div class="mini-goal-empty">No mini goals set. Add some milestones!</div>';
      return;
    }

    const progress = await this.calculateProgress();
    
    container.innerHTML = `
      <div class="mini-goals-progress">
        <div class="mini-progress-bar">
          <div class="mini-progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="mini-progress-text">${progress}% of mini goals completed</div>
      </div>
      <ul class="mini-goals-items">
        ${goals.map(goal => `
          <li class="mini-goal-item ${goal.completed ? 'completed' : ''}">
            <div class="mini-goal-content">
              <button class="mini-goal-toggle" onclick="miniGoalsManager.toggleMiniGoal('${goal.id}')">
                ${goal.completed ? '✓' : '○'}
              </button>
              <span class="mini-goal-text ${goal.completed ? 'done' : ''}">${goal.text}</span>
              ${goal.targetDate ? `<span class="mini-goal-date">${this.formatDate(goal.targetDate)}</span>` : ''}
            </div>
            <button class="mini-goal-delete" onclick="miniGoalsManager.deleteMiniGoal('${goal.id}')" title="Delete">×</button>
          </li>
        `).join('')}
      </ul>
    `;
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  }

  async initializeMiniGoals() {
    await this.renderMiniGoals();
    this.bindEvents();
  }

  bindEvents() {
    // Add mini goal form
    const addForm = document.getElementById('add-mini-goal-form');
    const addInput = document.getElementById('mini-goal-input');
    const addButton = document.getElementById('add-mini-goal');

    if (addButton && addInput) {
      addButton.addEventListener('click', async () => {
        const text = addInput.value.trim();
        if (text) {
          const dateInput = document.getElementById('mini-goal-date');
          const targetDate = dateInput ? dateInput.value : null;
          
          await this.addMiniGoal(text, targetDate);
          addInput.value = '';
          if (dateInput) dateInput.value = '';
        }
      });

      addInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addButton.click();
        }
      });
    }
  }
}

// Global mini goals manager
let miniGoalsManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof storage !== 'undefined') {
    miniGoalsManager = new MiniGoalsManager(storage);
  }
});

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MiniGoalsManager;
} else {
  window.MiniGoalsManager = MiniGoalsManager;
}
