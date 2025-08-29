// Theme Customization System
class ThemeManager {
  constructor(storage) {
    this.storage = storage;
    this.KEY_THEME_SETTINGS = 'themeSettings';
    this.themes = {
      dark: {
        name: 'Dark Mode',
        colors: {
          '--bg': '#0b1220',
          '--panel': '#111827',
          '--panel2': '#0f172a',
          '--text': '#e6edf3',
          '--muted': '#b3bdc9',
          '--border': '#2a2f3a',
          '--accent': '#7c3aed',
          '--green': '#22c55e'
        }
      },
      light: {
        name: 'Light Mode',
        colors: {
          '--bg': '#ffffff',
          '--panel': '#f8fafc',
          '--panel2': '#f1f5f9',
          '--text': '#1e293b',
          '--muted': '#64748b',
          '--border': '#e2e8f0',
          '--accent': '#7c3aed',
          '--green': '#22c55e'
        }
      },
      lakshya: {
        name: 'Lakshya Sanskrit',
        colors: {
          '--bg': '#0a0e1a',
          '--panel': '#1a1f2e',
          '--panel2': '#141829',
          '--text': '#f4f1e8',
          '--muted': '#c9b99a',
          '--border': '#3d2914',
          '--accent': '#d4af37',
          '--green': '#4ade80'
        },
        fonts: {
          '--font-primary': '"Noto Sans Devanagari", "Inter", sans-serif',
          '--font-secondary': '"Crimson Text", serif'
        }
      }
    };
  }

  async getThemeSettings() {
    return await this.storage.get(this.KEY_THEME_SETTINGS, {
      currentTheme: 'dark',
      autoSwitch: false,
      customColors: {}
    });
  }

  async setTheme(themeName) {
    const settings = await this.getThemeSettings();
    settings.currentTheme = themeName;
    await this.storage.set(this.KEY_THEME_SETTINGS, settings);
    
    this.applyTheme(themeName);
    
    if (window.analytics) {
      window.analytics.track('theme_changed', { theme: themeName });
    }
  }

  applyTheme(themeName) {
    const theme = this.themes[themeName];
    if (!theme) return;

    const root = document.documentElement;
    
    // Apply colors
    Object.entries(theme.colors).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Apply fonts if available
    if (theme.fonts) {
      Object.entries(theme.fonts).forEach(([property, value]) => {
        root.style.setProperty(property, value);
      });
    }

    // Add theme class to body
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${themeName}`);

    // Update theme selector
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = themeName;
    }

    // Show theme change notification
    this.showThemeChangeNotification(theme.name);
  }

  showThemeChangeNotification(themeName) {
    const messages = {
      'Dark Mode': '🌙 Dark mode activated',
      'Light Mode': '☀️ Light mode activated', 
      'Lakshya Sanskrit': '🕉️ Lakshya theme activated - संस्कृत शैली!'
    };
    
    const message = messages[themeName] || `Theme changed to ${themeName}`;
    this.showToast(message, 'info');
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.className = `toast ${type} show`;
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
  }

  async detectSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  async initializeAutoSwitch() {
    const settings = await this.getThemeSettings();
    if (!settings.autoSwitch) return;

    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', async (e) => {
        const newTheme = e.matches ? 'dark' : 'light';
        await this.setTheme(newTheme);
      });
    }
  }

  renderThemeSelector() {
    const container = document.getElementById('theme-selector');
    if (!container) return;

    container.innerHTML = `
      <div class="theme-section">
        <h3>🎨 Theme Customization</h3>
        
        <div class="theme-selector-group">
          <label for="theme-select">Choose Theme:</label>
          <select id="theme-select" class="theme-select">
            ${Object.entries(this.themes).map(([key, theme]) => `
              <option value="${key}">${theme.name}</option>
            `).join('')}
          </select>
        </div>
        
        <div class="theme-previews">
          ${Object.entries(this.themes).map(([key, theme]) => `
            <div class="theme-preview" data-theme="${key}" onclick="themeManager.setTheme('${key}')">
              <div class="theme-preview-colors">
                <div class="color-dot" style="background: ${theme.colors['--bg']}"></div>
                <div class="color-dot" style="background: ${theme.colors['--panel']}"></div>
                <div class="color-dot" style="background: ${theme.colors['--accent']}"></div>
                <div class="color-dot" style="background: ${theme.colors['--green']}"></div>
              </div>
              <div class="theme-preview-name">${theme.name}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="theme-options">
          <label class="theme-checkbox">
            <input type="checkbox" id="auto-theme-switch">
            <span>Auto-switch with system theme</span>
          </label>
        </div>
        
        <div class="theme-info">
          <small>💡 Lakshya theme includes Sanskrit-inspired typography and warm colors for focused meditation.</small>
        </div>
      </div>
    `;

    this.bindThemeEvents();
  }

  async bindThemeEvents() {
    const themeSelect = document.getElementById('theme-select');
    const autoSwitch = document.getElementById('auto-theme-switch');

    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
      });
    }

    if (autoSwitch) {
      const settings = await this.getThemeSettings();
      autoSwitch.checked = settings.autoSwitch;
      
      autoSwitch.addEventListener('change', async (e) => {
        const settings = await this.getThemeSettings();
        settings.autoSwitch = e.target.checked;
        await this.storage.set(this.KEY_THEME_SETTINGS, settings);
        
        if (e.target.checked) {
          const systemTheme = await this.detectSystemTheme();
          await this.setTheme(systemTheme);
          this.initializeAutoSwitch();
        }
      });
    }
  }

  async addCustomAffirmations() {
    const container = document.getElementById('custom-affirmations');
    if (!container) return;

    const affirmations = await this.storage.get('customAffirmations', [
      "मैं अपने लक्ष्य की ओर बढ़ रहा हूँ। (I am moving towards my goal.)",
      "हर दिन मैं बेहतर बन रहा हूँ। (Every day I am becoming better.)",
      "मेरी मेहनत रंग लाएगी। (My hard work will pay off.)",
      "मैं केंद्रित और शांत हूँ। (I am focused and calm.)"
    ]);

    container.innerHTML = `
      <div class="affirmations-section">
        <h3>🧘‍♂️ Daily Affirmations</h3>
        
        <div class="current-affirmation">
          <div id="daily-affirmation" class="affirmation-text">
            ${affirmations[Math.floor(Math.random() * affirmations.length)]}
          </div>
          <button onclick="themeManager.showNewAffirmation()" class="affirmation-btn">
            🔄 New Affirmation
          </button>
        </div>
        
        <div class="affirmation-settings">
          <label>
            <input type="checkbox" id="morning-affirmation" checked>
            Show morning affirmation
          </label>
          <label>
            <input type="time" id="affirmation-time" value="08:00">
            Reminder time
          </label>
        </div>
      </div>
    `;

    this.bindAffirmationEvents();
  }

  async showNewAffirmation() {
    const affirmations = await this.storage.get('customAffirmations', []);
    const randomAffirmation = affirmations[Math.floor(Math.random() * affirmations.length)];
    
    const affirmationElement = document.getElementById('daily-affirmation');
    if (affirmationElement) {
      affirmationElement.textContent = randomAffirmation;
    }
  }

  bindAffirmationEvents() {
    const morningToggle = document.getElementById('morning-affirmation');
    const timeInput = document.getElementById('affirmation-time');

    if (morningToggle) {
      morningToggle.addEventListener('change', async (e) => {
        await this.storage.set('morningAffirmationEnabled', e.target.checked);
      });
    }

    if (timeInput) {
      timeInput.addEventListener('change', async (e) => {
        await this.storage.set('affirmationTime', e.target.value);
      });
    }
  }

  async scheduleMorningAffirmation() {
    const enabled = await this.storage.get('morningAffirmationEnabled', true);
    const time = await this.storage.get('affirmationTime', '08:00');
    
    if (!enabled) return;

    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const affirmationTime = new Date();
    affirmationTime.setHours(hours, minutes, 0, 0);

    if (affirmationTime <= now) {
      affirmationTime.setDate(affirmationTime.getDate() + 1);
    }

    const timeUntilAffirmation = affirmationTime.getTime() - now.getTime();

    setTimeout(() => {
      this.showMorningAffirmation();
      this.scheduleMorningAffirmation(); // Schedule next day
    }, timeUntilAffirmation);
  }

  async showMorningAffirmation() {
    const affirmations = await this.storage.get('customAffirmations', []);
    const randomAffirmation = affirmations[Math.floor(Math.random() * affirmations.length)];
    
    this.showToast(`🌅 ${randomAffirmation}`, 'success');
  }

  async initializeThemeManager() {
    const settings = await this.getThemeSettings();
    
    // Apply saved theme
    this.applyTheme(settings.currentTheme);
    
    // Render UI components
    this.renderThemeSelector();
    await this.addCustomAffirmations();
    
    // Initialize auto-switch if enabled
    if (settings.autoSwitch) {
      await this.initializeAutoSwitch();
    }
    
    // Schedule morning affirmations
    await this.scheduleMorningAffirmation();
  }
}

// Global theme manager instance
let themeManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof storage !== 'undefined') {
    themeManager = new ThemeManager(storage);
  }
});

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
} else {
  window.ThemeManager = ThemeManager;
}
