// Streaks & Motivation System
class StreakManager {
  constructor(storage) {
    this.storage = storage;
    this.KEY_STREAKS = 'streakData';
    this.KEY_LAST_ACTIVITY = 'lastActivityDate';
  }

  async getStreakData() {
    return await this.storage.get(this.KEY_STREAKS, {
      taskStreak: 0,
      pomoStreak: 0,
      maxTaskStreak: 0,
      maxPomoStreak: 0,
      streakStartDate: null
    });
  }

  async updateTaskStreak() {
    const today = new Date().toDateString();
    const lastActivity = await this.storage.get(this.KEY_LAST_ACTIVITY, null);
    const streakData = await this.getStreakData();

    if (lastActivity === today) return streakData; // Already updated today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastActivity === yesterday.toDateString()) {
      // Continue streak
      streakData.taskStreak++;
    } else if (lastActivity !== today) {
      // Streak broken or first time
      if (streakData.taskStreak > 0) {
        this.showStreakBrokenMotivation();
      }
      streakData.taskStreak = 1;
      streakData.streakStartDate = today;
    }

    streakData.maxTaskStreak = Math.max(streakData.maxTaskStreak, streakData.taskStreak);
    
    await this.storage.set(this.KEY_STREAKS, streakData);
    await this.storage.set(this.KEY_LAST_ACTIVITY, today);
    
    this.updateStreakDisplay();
    return streakData;
  }

  async updatePomoStreak() {
    const streakData = await this.getStreakData();
    streakData.pomoStreak++;
    streakData.maxPomoStreak = Math.max(streakData.maxPomoStreak, streakData.pomoStreak);
    
    await this.storage.set(this.KEY_STREAKS, streakData);
    this.updateStreakDisplay();
    
    if (streakData.pomoStreak % 5 === 0) {
      this.showMotivationalQuote();
    }
  }

  showStreakBrokenMotivation() {
    const quotes = [
      "गिरना मत, उठना सीखो। (Don't fall, learn to rise.)",
      "हर नई शुरुआत एक अवसर है। (Every new beginning is an opportunity.)",
      "असफलता सफलता की सीढ़ी है। (Failure is the ladder to success.)",
      "धैर्य और अभ्यास से सब कुछ संभव है। (With patience and practice, everything is possible.)"
    ];
    
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    this.showToast(`🔥 Streak Reset! ${randomQuote}`, 'motivation');
  }

  showMotivationalQuote() {
    const quotes = [
      "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन। (Focus on action, not results.)",
      "उद्यमेन हि सिध्यन्ति कार्याणि न मनोरथैः। (Success comes through effort, not wishes.)",
      "अभ्यासेन तु कौन्तेय वैराग्येण च गृह्यते। (Through practice and detachment, it is achieved.)",
      "श्रेयान्स्वधर्मो विगुणः परधर्मात्स्वनुष्ठितात्। (Better your own path than another's perfection.)"
    ];
    
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    this.showToast(`🏆 ${randomQuote}`, 'success');
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.className = `toast ${type} show`;
      setTimeout(() => toast.classList.remove('show'), 4000);
    }
  }

  async updateStreakDisplay() {
    const streakData = await this.getStreakData();
    
    // Update streak display in the UI
    const streakElement = document.getElementById('streak');
    if (streakElement) {
      streakElement.innerHTML = `
        <div class="streak-item">
          <div class="streak-number">${streakData.taskStreak}</div>
          <div class="streak-label">Day Streak</div>
        </div>
        <div class="streak-item">
          <div class="streak-number">${streakData.pomoStreak}</div>
          <div class="streak-label">Focus Sessions</div>
        </div>
        <div class="streak-item">
          <div class="streak-number">${streakData.maxTaskStreak}</div>
          <div class="streak-label">Best Streak</div>
        </div>
      `;
    }

    // Weekly badge check
    if (streakData.taskStreak >= 7) {
      this.showWeeklyBadge();
    }
  }

  showWeeklyBadge() {
    this.showToast('🏆 Lakshya Achiever! 7-day streak completed!', 'success');
  }

  async initializeStreaks() {
    await this.updateStreakDisplay();
    await this.showDailyQuote();
    this.bindStreakEvents();
  }

  async showDailyQuote() {
    const quotes = [
      "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन। - You have the right to perform your actions, but not to the fruits of action.",
      "योगः कर्मसु कौशलम्। - Yoga is skill in action.",
      "श्रेयान्स्वधर्मो विगुणः परधर्मात्स्वनुष्ठितात्। - Better is one's own dharma, though imperfectly performed.",
      "अभ्यासेन तु कौन्तेय वैराग्येण च गृह्यते। - Through practice and detachment, it can be attained.",
      "उद्यमेन हि सिध्यन्ति कार्याणि न मनोरथैः। - Success comes through effort, not mere wishes.",
      "धैर्यं यस्य पिता क्षमा यस्य माता। - Patience is the father, forgiveness is the mother.",
      "विद्या ददाति विनयं विनयाद्याति पात्रताम्। - Knowledge gives humility, from humility comes worthiness.",
      "सत्यमेव जयते नानृतम्। - Truth alone triumphs, not falsehood."
    ];

    const today = new Date().toDateString();
    const quoteIndex = Math.abs(today.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % quotes.length;
    const todayQuote = quotes[quoteIndex];

    // Show quote in streak section
    const streakEl = document.getElementById('streak');
    if (streakEl) {
      const quoteEl = streakEl.querySelector('.daily-quote') || document.createElement('div');
      quoteEl.className = 'daily-quote';
      quoteEl.innerHTML = `<div class="sanskrit-quote">${todayQuote}</div>`;
      
      if (!streakEl.querySelector('.daily-quote')) {
        streakEl.appendChild(quoteEl);
      }
    }

    // Also show in welcome section occasionally
    const welcomeQuote = document.getElementById('welcome-quote');
    if (welcomeQuote && Math.random() < 0.3) {
      welcomeQuote.textContent = todayQuote.split(' - ')[1] || todayQuote;
    }
  }

  bindStreakEvents() {
    // Add event listeners for streak events
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StreakManager;
} else {
  window.StreakManager = StreakManager;
}
