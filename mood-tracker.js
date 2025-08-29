// Mood & Energy Tracking System
class MoodTracker {
  constructor(storage) {
    this.storage = storage;
    this.KEY_MOOD_DATA = 'moodTrackingData';
    this.KEY_ENERGY_DATA = 'energyTrackingData';
  }

  async initializeMoodTracker() {
    this.createMoodWidget();
    await this.renderMoodHistory();
    this.bindMoodEvents();
  }

  createMoodWidget() {
    const moodCard = document.createElement('div');
    moodCard.className = 'section card';
    moodCard.id = 'mood-tracker-card';
    moodCard.innerHTML = `
      <h2>🧘 Mood & Energy</h2>
      <div class="mood-input-section">
        <div class="mood-selector">
          <label class="muted small">How are you feeling?</label>
          <div class="mood-options">
            <button class="mood-btn" data-mood="5" title="Excellent">😄</button>
            <button class="mood-btn" data-mood="4" title="Good">😊</button>
            <button class="mood-btn" data-mood="3" title="Neutral">😐</button>
            <button class="mood-btn" data-mood="2" title="Low">😔</button>
            <button class="mood-btn" data-mood="1" title="Very Low">😞</button>
          </div>
        </div>
        <div class="energy-selector" style="margin-top:12px;">
          <label class="muted small">Energy Level</label>
          <div class="energy-options">
            <button class="energy-btn" data-energy="5" title="High Energy">⚡</button>
            <button class="energy-btn" data-energy="4" title="Good Energy">🔋</button>
            <button class="energy-btn" data-energy="3" title="Moderate">🟡</button>
            <button class="energy-btn" data-energy="2" title="Low Energy">🔴</button>
            <button class="energy-btn" data-energy="1" title="Exhausted">😴</button>
          </div>
        </div>
        <button id="save-mood" class="primary" style="margin-top:12px;">Save</button>
      </div>
      <div id="mood-insights" class="mood-insights" style="margin-top:16px;"></div>
      <div id="mood-history" class="mood-history" style="margin-top:12px;"></div>
    `;

    // Insert after journal card
    const journalCard = document.getElementById('journal-card');
    if (journalCard) {
      journalCard.parentNode.insertBefore(moodCard, journalCard.nextSibling);
    }
  }

  bindMoodEvents() {
    // Mood selection
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Energy selection
    document.querySelectorAll('.energy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Save mood
    document.getElementById('save-mood')?.addEventListener('click', () => {
      this.saveMoodEntry();
    });
  }

  async saveMoodEntry() {
    const selectedMood = document.querySelector('.mood-btn.selected')?.dataset.mood;
    const selectedEnergy = document.querySelector('.energy-btn.selected')?.dataset.energy;

    if (!selectedMood || !selectedEnergy) {
      showToast('Please select both mood and energy level');
      return;
    }

    const today = new Date().toDateString();
    const timestamp = new Date().toISOString();
    
    const moodData = await this.storage.get(this.KEY_MOOD_DATA, {});
    
    if (!moodData[today]) {
      moodData[today] = [];
    }
    
    moodData[today].push({
      mood: parseInt(selectedMood),
      energy: parseInt(selectedEnergy),
      timestamp: timestamp
    });

    await this.storage.set(this.KEY_MOOD_DATA, moodData);
    
    // Clear selections
    document.querySelectorAll('.mood-btn, .energy-btn').forEach(btn => {
      btn.classList.remove('selected');
    });

    showToast('Mood & energy logged! 🌟');
    await this.renderMoodHistory();
    await this.generateInsights();
  }

  async renderMoodHistory() {
    const moodData = await this.storage.get(this.KEY_MOOD_DATA, {});
    const historyEl = document.getElementById('mood-history');
    if (!historyEl) return;

    const last7Days = this.getLast7Days();
    let historyHTML = '<div class="mood-week-view">';
    
    last7Days.forEach(date => {
      const dayData = moodData[date] || [];
      const avgMood = dayData.length > 0 ? 
        Math.round(dayData.reduce((sum, entry) => sum + entry.mood, 0) / dayData.length) : 0;
      const avgEnergy = dayData.length > 0 ? 
        Math.round(dayData.reduce((sum, entry) => sum + entry.energy, 0) / dayData.length) : 0;
      
      const dayName = new Date(date).toLocaleDateString('en', { weekday: 'short' });
      const moodEmoji = this.getMoodEmoji(avgMood);
      const energyEmoji = this.getEnergyEmoji(avgEnergy);
      
      historyHTML += `
        <div class="mood-day ${dayData.length > 0 ? 'has-data' : ''}">
          <div class="day-name muted small">${dayName}</div>
          <div class="mood-display">${moodEmoji}</div>
          <div class="energy-display">${energyEmoji}</div>
        </div>
      `;
    });
    
    historyHTML += '</div>';
    historyEl.innerHTML = historyHTML;
  }

  async generateInsights() {
    const moodData = await this.storage.get(this.KEY_MOOD_DATA, {});
    const insightsEl = document.getElementById('mood-insights');
    if (!insightsEl) return;

    const last7Days = this.getLast7Days();
    const recentEntries = [];
    
    last7Days.forEach(date => {
      if (moodData[date]) {
        recentEntries.push(...moodData[date]);
      }
    });

    if (recentEntries.length === 0) {
      insightsEl.innerHTML = '<div class="muted small">Track your mood for insights!</div>';
      return;
    }

    const avgMood = recentEntries.reduce((sum, entry) => sum + entry.mood, 0) / recentEntries.length;
    const avgEnergy = recentEntries.reduce((sum, entry) => sum + entry.energy, 0) / recentEntries.length;
    
    let insight = '';
    if (avgMood >= 4 && avgEnergy >= 4) {
      insight = '🌟 You\'re in great spirits! Perfect time for challenging tasks.';
    } else if (avgMood >= 3 && avgEnergy < 3) {
      insight = '😌 Good mood but low energy. Try lighter tasks or take a break.';
    } else if (avgMood < 3 && avgEnergy >= 3) {
      insight = '💪 You have energy but mood is low. Physical tasks might help.';
    } else if (avgMood < 3 && avgEnergy < 3) {
      insight = '🛌 Consider rest and self-care. Tomorrow is a new day!';
    } else {
      insight = '⚖️ Balanced state. Good for routine tasks and planning.';
    }

    insightsEl.innerHTML = `<div class="mood-insight">${insight}</div>`;
  }

  getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toDateString());
    }
    return days;
  }

  getMoodEmoji(mood) {
    const emojis = ['', '😞', '😔', '😐', '😊', '😄'];
    return emojis[mood] || '—';
  }

  getEnergyEmoji(energy) {
    const emojis = ['', '😴', '🔴', '🟡', '🔋', '⚡'];
    return emojis[energy] || '—';
  }
}

// Initialize if storage is available
if (typeof storage !== 'undefined') {
  window.moodTracker = new MoodTracker(storage);
}
