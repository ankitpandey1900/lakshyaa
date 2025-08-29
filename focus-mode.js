// Focus Mode Overlay System
class FocusMode {
  constructor() {
    this.isActive = false;
    this.currentTask = null;
    this.ambientSounds = {
      rain: { name: 'Rain', frequency: 440, type: 'noise' },
      forest: { name: 'Forest', frequency: 220, type: 'nature' },
      ocean: { name: 'Ocean Waves', frequency: 110, type: 'waves' },
      silence: { name: 'Silence', frequency: null, type: 'none' }
    };
    this.currentSound = 'silence';
    this.audioContext = null;
    this.oscillator = null;
  }

  createFocusOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'focus-overlay';
    overlay.className = 'focus-overlay';
    overlay.innerHTML = `
      <div class="focus-container">
        <div class="focus-header">
          <h1 class="focus-title">🧘‍♂️ Focus Mode</h1>
          <button id="exit-focus" class="focus-exit">✕</button>
        </div>
        
        <div class="focus-content">
          <div class="focus-timer-section">
            <div class="focus-timer-ring">
              <div class="focus-timer-display" id="focus-timer">25:00</div>
            </div>
            <div class="focus-mode-label" id="focus-mode-label">Focus Session</div>
          </div>
          
          <div class="focus-task-section">
            <div class="focus-current-task">
              <h3>Current Task</h3>
              <div id="focus-task-display" class="focus-task-text">No task selected</div>
              <button id="focus-select-task" class="focus-btn secondary">Select Task</button>
            </div>
          </div>
          
          <div class="focus-quote-section">
            <div id="focus-quote" class="focus-quote">
              कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।<br>
              <span class="focus-quote-translation">Focus on action, not results.</span>
            </div>
          </div>
          
          <div class="focus-controls">
            <button id="focus-start-timer" class="focus-btn primary">Start Focus</button>
            <button id="focus-pause-timer" class="focus-btn">Pause</button>
            <button id="focus-reset-timer" class="focus-btn">Reset</button>
          </div>
          
          <div class="focus-ambient-section">
            <h4>Ambient Sounds</h4>
            <div class="ambient-controls">
              <select id="ambient-sound-select" class="focus-select">
                <option value="silence">Silence</option>
                <option value="rain">Rain</option>
                <option value="forest">Forest</option>
                <option value="ocean">Ocean Waves</option>
              </select>
              <input type="range" id="ambient-volume" class="focus-slider" min="0" max="100" value="30">
              <span class="volume-label">🔊</span>
            </div>
          </div>
          
          <div class="focus-progress-section">
            <div class="focus-progress-bar">
              <div id="focus-progress-fill" class="focus-progress-fill"></div>
            </div>
            <div class="focus-stats">
              <span id="focus-session-count">Session 1 of 4</span>
              <span id="focus-total-time">Total: 0h 0m</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.bindFocusEvents();
  }

  bindFocusEvents() {
    // Exit focus mode
    document.getElementById('exit-focus').addEventListener('click', () => {
      this.exitFocusMode();
    });

    // Escape key to exit
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isActive) {
        this.exitFocusMode();
      }
    });

    // Timer controls
    document.getElementById('focus-start-timer').addEventListener('click', () => {
      this.startFocusTimer();
    });

    document.getElementById('focus-pause-timer').addEventListener('click', () => {
      this.pauseFocusTimer();
    });

    document.getElementById('focus-reset-timer').addEventListener('click', () => {
      this.resetFocusTimer();
    });

    // Task selection
    document.getElementById('focus-select-task').addEventListener('click', () => {
      this.showTaskSelector();
    });

    // Ambient sound controls
    document.getElementById('ambient-sound-select').addEventListener('change', (e) => {
      this.changeAmbientSound(e.target.value);
    });

    document.getElementById('ambient-volume').addEventListener('input', (e) => {
      this.setAmbientVolume(e.target.value);
    });
  }

  enterFocusMode(taskText = null) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.currentTask = taskText;
    
    // Create overlay if it doesn't exist
    if (!document.getElementById('focus-overlay')) {
      this.createFocusOverlay();
    }
    
    // Show overlay
    const overlay = document.getElementById('focus-overlay');
    overlay.style.display = 'flex';
    
    // Update task display
    if (taskText) {
      document.getElementById('focus-task-display').textContent = taskText;
    }
    
    // Show motivational quote
    this.showRandomQuote();
    
    // Hide main UI
    document.querySelector('.page').style.display = 'none';
    document.querySelector('.quickbar').style.display = 'none';
    
    // Track analytics
    if (window.analytics) {
      window.analytics.track('focus_mode_entered', { task: taskText });
    }
  }

  exitFocusMode() {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Stop ambient sounds
    this.stopAmbientSound();
    
    // Hide overlay
    const overlay = document.getElementById('focus-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    
    // Show main UI
    document.querySelector('.page').style.display = 'block';
    document.querySelector('.quickbar').style.display = 'block';
    
    // Track analytics
    if (window.analytics) {
      window.analytics.track('focus_mode_exited');
    }
  }

  showRandomQuote() {
    const quotes = [
      {
        sanskrit: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।",
        translation: "Focus on action, not results."
      },
      {
        sanskrit: "उद्यमेन हि सिध्यन्ति कार्याणि न मनोरथैः।",
        translation: "Success comes through effort, not wishes."
      },
      {
        sanskrit: "अभ्यासेन तु कौन्तेय वैराग्येण च गृह्यते।",
        translation: "Through practice and detachment, it is achieved."
      },
      {
        sanskrit: "योगः कर्मसु कौशलम्।",
        translation: "Yoga is skill in action."
      },
      {
        sanskrit: "सर्वारम्भा हि दोषेण धूमेनाग्निरिवावृताः।",
        translation: "All undertakings are clouded by faults, as fire by smoke."
      }
    ];
    
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    const quoteElement = document.getElementById('focus-quote');
    
    if (quoteElement) {
      quoteElement.innerHTML = `
        ${randomQuote.sanskrit}<br>
        <span class="focus-quote-translation">${randomQuote.translation}</span>
      `;
    }
  }

  showTaskSelector() {
    // Get today's tasks
    const todayList = document.getElementById('today-list');
    const tasks = Array.from(todayList.querySelectorAll('li:not(.done)'))
      .map(li => li.textContent.replace('✓', '').trim());
    
    if (tasks.length === 0) {
      alert('No pending tasks for today. Add some tasks first!');
      return;
    }
    
    const selectedTask = prompt(`Select a task to focus on:\n\n${tasks.map((task, i) => `${i + 1}. ${task}`).join('\n')}\n\nEnter task number:`);
    
    if (selectedTask && !isNaN(selectedTask)) {
      const taskIndex = parseInt(selectedTask) - 1;
      if (taskIndex >= 0 && taskIndex < tasks.length) {
        this.currentTask = tasks[taskIndex];
        document.getElementById('focus-task-display').textContent = this.currentTask;
      }
    }
  }

  initializeAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  changeAmbientSound(soundType) {
    this.stopAmbientSound();
    this.currentSound = soundType;
    
    if (soundType !== 'silence') {
      this.playAmbientSound(soundType);
    }
  }

  playAmbientSound(soundType) {
    this.initializeAudioContext();
    
    const sound = this.ambientSounds[soundType];
    if (!sound || !sound.frequency) return;
    
    // Create oscillator for simple ambient sound
    this.oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    this.oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Configure sound based on type
    if (sound.type === 'noise') {
      this.oscillator.type = 'sawtooth';
      this.oscillator.frequency.setValueAtTime(sound.frequency, this.audioContext.currentTime);
    } else if (sound.type === 'waves') {
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(sound.frequency, this.audioContext.currentTime);
    } else {
      this.oscillator.type = 'triangle';
      this.oscillator.frequency.setValueAtTime(sound.frequency, this.audioContext.currentTime);
    }
    
    // Set initial volume
    const volume = document.getElementById('ambient-volume').value / 100 * 0.1; // Keep it low
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    
    this.oscillator.start();
  }

  stopAmbientSound() {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator = null;
    }
  }

  setAmbientVolume(volume) {
    if (this.oscillator && this.audioContext) {
      const gainNode = this.oscillator.context.createGain();
      const volumeValue = volume / 100 * 0.1; // Keep it low
      gainNode.gain.setValueAtTime(volumeValue, this.audioContext.currentTime);
    }
  }

  startFocusTimer() {
    // Integrate with existing Pomodoro timer
    const startButton = document.getElementById('pomo-start');
    if (startButton) {
      startButton.click();
    }
  }

  pauseFocusTimer() {
    const pauseButton = document.getElementById('pomo-pause');
    if (pauseButton) {
      pauseButton.click();
    }
  }

  resetFocusTimer() {
    const resetButton = document.getElementById('pomo-reset');
    if (resetButton) {
      resetButton.click();
    }
  }
}

// Global focus mode instance
const focusMode = new FocusMode();

// Global function to enter focus mode
function enterFocusMode(taskText = null) {
  focusMode.enterFocusMode(taskText);
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FocusMode;
} else {
  window.FocusMode = FocusMode;
  window.focusMode = focusMode;
}
