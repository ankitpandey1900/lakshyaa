// Achievement & Gamification System
class AchievementSystem {
  constructor(storage) {
    this.storage = storage;
    this.KEY_ACHIEVEMENTS = 'achievementData';
    this.KEY_USER_STATS = 'userStats';
    this.KEY_LEVEL_DATA = 'levelData';
    
    this.achievements = {
      'first_task': { name: 'Getting Started', desc: 'Complete your first task', icon: '🎯', points: 10 },
      'streak_3': { name: 'On Fire', desc: '3-day task streak', icon: '🔥', points: 25 },
      'streak_7': { name: 'Week Warrior', desc: '7-day task streak', icon: '⚡', points: 50 },
      'pomo_master': { name: 'Focus Master', desc: 'Complete 25 Pomodoro sessions', icon: '🧘', points: 75 },
      'early_bird': { name: 'Early Bird', desc: 'Complete tasks before 9 AM', icon: '🌅', points: 30 },
      'night_owl': { name: 'Night Owl', desc: 'Complete tasks after 10 PM', icon: '🦉', points: 30 },
      'goal_crusher': { name: 'Goal Crusher', desc: 'Complete a major deadline', icon: '🏆', points: 100 },
      'journal_keeper': { name: 'Reflective Soul', desc: 'Write 10 journal entries', icon: '📝', points: 40 },
      'perfectionist': { name: 'Perfectionist', desc: '100% task completion for a week', icon: '💎', points: 80 },
      'comeback_kid': { name: 'Comeback Kid', desc: 'Clear entire backlog', icon: '💪', points: 60 }
    };
  }

  async initializeAchievements() {
    await this.createAchievementWidget();
    await this.checkForNewAchievements();
    this.bindAchievementEvents();
  }

  async createAchievementWidget() {
    const achievementCard = document.createElement('div');
    achievementCard.className = 'section card';
    achievementCard.id = 'achievement-card';
    
    const userData = await this.getUserStats();
    const level = this.calculateLevel(userData.totalPoints);
    const nextLevelPoints = this.getPointsForLevel(level + 1);
    const progress = ((userData.totalPoints - this.getPointsForLevel(level)) / (nextLevelPoints - this.getPointsForLevel(level))) * 100;
    
    achievementCard.innerHTML = `
      <h2>🏆 Achievements</h2>
      <div class="level-display">
        <div class="level-info">
          <span class="level-badge">Level ${level}</span>
          <span class="points-display">${userData.totalPoints} XP</span>
        </div>
        <div class="level-progress">
          <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="next-level muted small">Next: Level ${level + 1} (${nextLevelPoints - userData.totalPoints} XP to go)</div>
      </div>
      <div id="recent-achievements" class="recent-achievements"></div>
      <button id="view-all-achievements" class="secondary">View All Achievements</button>
    `;

    // Insert after streak card
    const streakCard = document.getElementById('streak-card');
    if (streakCard) {
      streakCard.parentNode.insertBefore(achievementCard, streakCard.nextSibling);
    }
  }

  bindAchievementEvents() {
    document.getElementById('view-all-achievements')?.addEventListener('click', () => {
      this.showAchievementModal();
    });
  }

  async showAchievementModal() {
    const modal = document.createElement('div');
    modal.className = 'achievement-modal';
    modal.innerHTML = `
      <div class="achievement-modal-content">
        <div class="modal-header">
          <h2>🏆 All Achievements</h2>
          <button class="close-modal">×</button>
        </div>
        <div class="achievement-grid" id="achievement-grid"></div>
      </div>
    `;

    document.body.appendChild(modal);
    await this.renderAllAchievements();

    modal.querySelector('.close-modal').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  async renderAllAchievements() {
    const unlockedAchievements = await this.storage.get(this.KEY_ACHIEVEMENTS, []);
    const grid = document.getElementById('achievement-grid');
    if (!grid) return;

    let gridHTML = '';
    Object.entries(this.achievements).forEach(([key, achievement]) => {
      const unlocked = unlockedAchievements.some(a => a.key === key);
      gridHTML += `
        <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
          <div class="achievement-icon">${unlocked ? achievement.icon : '🔒'}</div>
          <div class="achievement-info">
            <div class="achievement-name">${achievement.name}</div>
            <div class="achievement-desc muted small">${achievement.desc}</div>
            <div class="achievement-points">+${achievement.points} XP</div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = gridHTML;
  }

  async checkForNewAchievements() {
    const userData = await this.getUserStats();
    const unlockedAchievements = await this.storage.get(this.KEY_ACHIEVEMENTS, []);
    const newAchievements = [];

    // Check each achievement condition
    if (userData.tasksCompleted >= 1 && !this.hasAchievement(unlockedAchievements, 'first_task')) {
      newAchievements.push('first_task');
    }

    if (userData.currentStreak >= 3 && !this.hasAchievement(unlockedAchievements, 'streak_3')) {
      newAchievements.push('streak_3');
    }

    if (userData.currentStreak >= 7 && !this.hasAchievement(unlockedAchievements, 'streak_7')) {
      newAchievements.push('streak_7');
    }

    if (userData.pomoSessionsCompleted >= 25 && !this.hasAchievement(unlockedAchievements, 'pomo_master')) {
      newAchievements.push('pomo_master');
    }

    if (userData.journalEntries >= 10 && !this.hasAchievement(unlockedAchievements, 'journal_keeper')) {
      newAchievements.push('journal_keeper');
    }

    // Unlock new achievements
    for (const achievementKey of newAchievements) {
      await this.unlockAchievement(achievementKey);
    }

    await this.renderRecentAchievements();
  }

  async unlockAchievement(achievementKey) {
    const achievement = this.achievements[achievementKey];
    if (!achievement) return;

    const unlockedAchievements = await this.storage.get(this.KEY_ACHIEVEMENTS, []);
    const userData = await this.getUserStats();

    // Add achievement
    unlockedAchievements.push({
      key: achievementKey,
      unlockedAt: new Date().toISOString(),
      ...achievement
    });

    // Add points
    userData.totalPoints += achievement.points;

    await this.storage.set(this.KEY_ACHIEVEMENTS, unlockedAchievements);
    await this.storage.set(this.KEY_USER_STATS, userData);

    // Show celebration
    this.showAchievementCelebration(achievement);
  }

  showAchievementCelebration(achievement) {
    const celebration = document.createElement('div');
    celebration.className = 'achievement-celebration';
    celebration.innerHTML = `
      <div class="celebration-content">
        <div class="celebration-icon">${achievement.icon}</div>
        <div class="celebration-title">Achievement Unlocked!</div>
        <div class="celebration-name">${achievement.name}</div>
        <div class="celebration-points">+${achievement.points} XP</div>
      </div>
    `;

    document.body.appendChild(celebration);

    setTimeout(() => {
      celebration.classList.add('show');
    }, 100);

    setTimeout(() => {
      celebration.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(celebration);
      }, 500);
    }, 3000);
  }

  async renderRecentAchievements() {
    const unlockedAchievements = await this.storage.get(this.KEY_ACHIEVEMENTS, []);
    const recentEl = document.getElementById('recent-achievements');
    if (!recentEl) return;

    const recent = unlockedAchievements
      .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
      .slice(0, 3);

    if (recent.length === 0) {
      recentEl.innerHTML = '<div class="muted small">Complete tasks to unlock achievements!</div>';
      return;
    }

    let recentHTML = '<div class="recent-list">';
    recent.forEach(achievement => {
      recentHTML += `
        <div class="recent-achievement">
          <span class="achievement-icon">${achievement.icon}</span>
          <span class="achievement-name">${achievement.name}</span>
          <span class="achievement-points">+${achievement.points}</span>
        </div>
      `;
    });
    recentHTML += '</div>';

    recentEl.innerHTML = recentHTML;
  }

  async getUserStats() {
    return await this.storage.get(this.KEY_USER_STATS, {
      totalPoints: 0,
      tasksCompleted: 0,
      currentStreak: 0,
      maxStreak: 0,
      pomoSessionsCompleted: 0,
      journalEntries: 0,
      goalsCompleted: 0
    });
  }

  async updateUserStats(statUpdates) {
    const userData = await this.getUserStats();
    Object.assign(userData, statUpdates);
    await this.storage.set(this.KEY_USER_STATS, userData);
    await this.checkForNewAchievements();
  }

  hasAchievement(achievements, key) {
    return achievements.some(a => a.key === key);
  }

  calculateLevel(points) {
    return Math.floor(Math.sqrt(points / 100)) + 1;
  }

  getPointsForLevel(level) {
    return Math.pow(level - 1, 2) * 100;
  }
}

// Initialize if storage is available
if (typeof storage !== 'undefined') {
  window.achievementSystem = new AchievementSystem(storage);
}
