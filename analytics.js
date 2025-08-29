// Privacy-friendly analytics (no personal data collection)
class Analytics {
  constructor(storage) {
    this.storage = storage;
    this.chartContainer = null;
  }

  async init() {
    this.chartContainer = document.getElementById('analytics-chart');
    if (this.chartContainer) {
      await this.renderDashboard();
    }
  }

  async renderDashboard() {
    const analytics = await this.generateAnalytics();
    
    const dashboardHTML = `
      <div class="analytics-dashboard">
        <h3>📊 Progress Analytics</h3>
        
        <div class="analytics-grid">
          <div class="analytics-card">
            <div class="analytics-metric">
              <span class="metric-value">${analytics.completionRate}%</span>
              <span class="metric-label">Task Completion Rate</span>
            </div>
            <div class="metric-trend ${analytics.completionTrend > 0 ? 'positive' : 'negative'}">
              ${analytics.completionTrend > 0 ? '↗️' : '↘️'} ${Math.abs(analytics.completionTrend)}%
            </div>
          </div>
          
          <div class="analytics-card">
            <div class="analytics-metric">
              <span class="metric-value">${analytics.currentStreak}</span>
              <span class="metric-label">Current Streak</span>
            </div>
            <div class="metric-trend positive">
              🔥 ${analytics.longestStreak} best
            </div>
          </div>
          
          <div class="analytics-card">
            <div class="analytics-metric">
              <span class="metric-value">${analytics.pomodoroCount}</span>
              <span class="metric-label">Pomodoros This Week</span>
            </div>
            <div class="metric-trend ${analytics.pomodoroTrend > 0 ? 'positive' : 'negative'}">
              ${analytics.pomodoroTrend > 0 ? '↗️' : '↘️'} ${Math.abs(analytics.pomodoroTrend)}
            </div>
          </div>
          
          <div class="analytics-card">
            <div class="analytics-metric">
              <span class="metric-value">${analytics.focusTime}h</span>
              <span class="metric-label">Focus Time Today</span>
            </div>
            <div class="metric-trend positive">
              ⏱️ ${analytics.avgFocusTime}h avg
            </div>
          </div>
        </div>
        
        <div class="progress-charts">
          <div class="chart-container">
            <h4>Weekly Progress</h4>
            <div class="weekly-chart" id="weekly-chart">
              ${this.renderWeeklyChart(analytics.weeklyData)}
            </div>
          </div>
          
          <div class="chart-container">
            <h4>Daily Patterns</h4>
            <div class="pattern-chart" id="pattern-chart">
              ${this.renderPatternChart(analytics.patterns)}
            </div>
          </div>
        </div>
        
        <div class="insights-section">
          <h4>💡 Insights & Recommendations</h4>
          <div class="insights-list">
            ${analytics.insights.map(insight => `
              <div class="insight-item ${insight.type}">
                <span class="insight-icon">${insight.icon}</span>
                <span class="insight-text">${insight.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    this.chartContainer.innerHTML = dashboardHTML;
  }

  async generateAnalytics() {
    const history = await this.storage.get('taskHistory') || {};
    const streaks = await this.storage.get('streaks') || {};
    const pomodoroHistory = await this.storage.get('pomodoroHistory') || [];
    
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Calculate completion rate
    const recentTasks = this.getRecentTasks(history, 7);
    const completionRate = recentTasks.length > 0 
      ? Math.round((recentTasks.filter(t => t.done).length / recentTasks.length) * 100)
      : 0;
    
    // Calculate trends
    const lastWeekTasks = this.getRecentTasks(history, 14).slice(0, -7);
    const lastWeekRate = lastWeekTasks.length > 0
      ? Math.round((lastWeekTasks.filter(t => t.done).length / lastWeekTasks.length) * 100)
      : 0;
    const completionTrend = completionRate - lastWeekRate;
    
    // Pomodoro analytics
    const weeklyPomodoros = pomodoroHistory.filter(p => 
      new Date(p.date) >= weekAgo && p.completed
    ).length;
    
    const lastWeekPomodoros = pomodoroHistory.filter(p => {
      const date = new Date(p.date);
      return date >= new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000) && 
             date < weekAgo && p.completed;
    }).length;
    
    const pomodoroTrend = weeklyPomodoros - lastWeekPomodoros;
    
    // Focus time calculation
    const todayPomodoros = pomodoroHistory.filter(p => 
      new Date(p.date).toDateString() === now.toDateString() && p.completed
    ).length;
    const focusTime = (todayPomodoros * 25) / 60; // Convert to hours
    
    const avgFocusTime = Math.round(
      (pomodoroHistory.filter(p => p.completed).length * 25) / 
      (60 * Math.max(1, this.getDaysSinceFirstTask(history)))
    );
    
    // Weekly data for chart
    const weeklyData = this.generateWeeklyData(history, pomodoroHistory);
    
    // Pattern analysis
    const patterns = this.analyzePatterns(history, pomodoroHistory);
    
    // Generate insights
    const insights = this.generateInsights({
      completionRate,
      completionTrend,
      pomodoroTrend,
      focusTime,
      patterns,
      streaks
    });
    
    return {
      completionRate,
      completionTrend,
      currentStreak: streaks.dailyTasks || 0,
      longestStreak: streaks.longestDaily || 0,
      pomodoroCount: weeklyPomodoros,
      pomodoroTrend,
      focusTime: Math.round(focusTime * 10) / 10,
      avgFocusTime: Math.round(avgFocusTime * 10) / 10,
      weeklyData,
      patterns,
      insights
    };
  }

  getRecentTasks(history, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const tasks = [];
    Object.entries(history).forEach(([date, dayTasks]) => {
      if (new Date(date) >= cutoff) {
        tasks.push(...dayTasks);
      }
    });
    
    return tasks;
  }

  getDaysSinceFirstTask(history) {
    const dates = Object.keys(history).sort();
    if (dates.length === 0) return 1;
    
    const firstDate = new Date(dates[0]);
    const now = new Date();
    return Math.max(1, Math.ceil((now - firstDate) / (24 * 60 * 60 * 1000)));
  }

  generateWeeklyData(history, pomodoroHistory) {
    const data = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTasks = history[dateStr] || [];
      const completedTasks = dayTasks.filter(t => t.done).length;
      const totalTasks = dayTasks.length;
      
      const dayPomodoros = pomodoroHistory.filter(p => 
        p.date.startsWith(dateStr) && p.completed
      ).length;
      
      data.push({
        day: date.toLocaleDateString('en', { weekday: 'short' }),
        tasks: totalTasks,
        completed: completedTasks,
        pomodoros: dayPomodoros,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      });
    }
    
    return data;
  }

  renderWeeklyChart(weeklyData) {
    const maxValue = Math.max(...weeklyData.map(d => Math.max(d.tasks, d.pomodoros)));
    const scale = maxValue > 0 ? 100 / maxValue : 1;
    
    return `
      <div class="chart-bars">
        ${weeklyData.map(day => `
          <div class="chart-day">
            <div class="chart-bar-group">
              <div class="chart-bar tasks" style="height: ${day.tasks * scale}%"
                   title="${day.tasks} tasks">
              </div>
              <div class="chart-bar completed" style="height: ${day.completed * scale}%"
                   title="${day.completed} completed">
              </div>
              <div class="chart-bar pomodoros" style="height: ${day.pomodoros * scale}%"
                   title="${day.pomodoros} pomodoros">
              </div>
            </div>
            <div class="chart-label">${day.day}</div>
            <div class="chart-rate">${day.completionRate}%</div>
          </div>
        `).join('')}
      </div>
      <div class="chart-legend">
        <div class="legend-item">
          <div class="legend-color tasks"></div>
          <span>Total Tasks</span>
        </div>
        <div class="legend-item">
          <div class="legend-color completed"></div>
          <span>Completed</span>
        </div>
        <div class="legend-item">
          <div class="legend-color pomodoros"></div>
          <span>Pomodoros</span>
        </div>
      </div>
    `;
  }

  analyzePatterns(history, pomodoroHistory) {
    const patterns = {
      bestDay: this.findBestDay(history),
      peakHours: this.findPeakHours(pomodoroHistory),
      productivity: this.calculateProductivityTrend(history)
    };
    
    return patterns;
  }

  findBestDay(history) {
    const dayStats = {};
    
    Object.entries(history).forEach(([date, tasks]) => {
      const day = new Date(date).toLocaleDateString('en', { weekday: 'long' });
      if (!dayStats[day]) dayStats[day] = { total: 0, completed: 0 };
      
      dayStats[day].total += tasks.length;
      dayStats[day].completed += tasks.filter(t => t.done).length;
    });
    
    let bestDay = 'Monday';
    let bestRate = 0;
    
    Object.entries(dayStats).forEach(([day, stats]) => {
      const rate = stats.total > 0 ? stats.completed / stats.total : 0;
      if (rate > bestRate) {
        bestRate = rate;
        bestDay = day;
      }
    });
    
    return { day: bestDay, rate: Math.round(bestRate * 100) };
  }

  findPeakHours(pomodoroHistory) {
    const hourStats = {};
    
    pomodoroHistory.forEach(session => {
      if (session.completed) {
        const hour = new Date(session.startTime || session.date).getHours();
        hourStats[hour] = (hourStats[hour] || 0) + 1;
      }
    });
    
    let peakHour = 9;
    let maxSessions = 0;
    
    Object.entries(hourStats).forEach(([hour, count]) => {
      if (count > maxSessions) {
        maxSessions = count;
        peakHour = parseInt(hour);
      }
    });
    
    const timeStr = peakHour < 12 ? `${peakHour}AM` : 
                   peakHour === 12 ? '12PM' : `${peakHour - 12}PM`;
    
    return { hour: peakHour, timeStr, sessions: maxSessions };
  }

  calculateProductivityTrend(history) {
    const recentWeek = this.getRecentTasks(history, 7);
    const previousWeek = this.getRecentTasks(history, 14).slice(0, -7);
    
    const recentRate = recentWeek.length > 0 ? 
      recentWeek.filter(t => t.done).length / recentWeek.length : 0;
    const previousRate = previousWeek.length > 0 ? 
      previousWeek.filter(t => t.done).length / previousWeek.length : 0;
    
    const trend = recentRate - previousRate;
    return {
      direction: trend > 0.05 ? 'up' : trend < -0.05 ? 'down' : 'stable',
      change: Math.round(Math.abs(trend) * 100)
    };
  }

  renderPatternChart(patterns) {
    return `
      <div class="pattern-items">
        <div class="pattern-item">
          <div class="pattern-icon">📅</div>
          <div class="pattern-info">
            <div class="pattern-label">Best Day</div>
            <div class="pattern-value">${patterns.bestDay.day}</div>
            <div class="pattern-detail">${patterns.bestDay.rate}% completion</div>
          </div>
        </div>
        
        <div class="pattern-item">
          <div class="pattern-icon">⏰</div>
          <div class="pattern-info">
            <div class="pattern-label">Peak Hours</div>
            <div class="pattern-value">${patterns.peakHours.timeStr}</div>
            <div class="pattern-detail">${patterns.peakHours.sessions} sessions</div>
          </div>
        </div>
        
        <div class="pattern-item">
          <div class="pattern-icon">📈</div>
          <div class="pattern-info">
            <div class="pattern-label">Trend</div>
            <div class="pattern-value">${patterns.productivity.direction === 'up' ? '↗️' : 
                                      patterns.productivity.direction === 'down' ? '↘️' : '➡️'}</div>
            <div class="pattern-detail">${patterns.productivity.change}% change</div>
          </div>
        </div>
      </div>
    `;
  }

  generateInsights(data) {
    const insights = [];
    
    // Completion rate insights
    if (data.completionRate >= 80) {
      insights.push({
        type: 'success',
        icon: '🎯',
        text: 'Excellent task completion rate! You\'re staying focused on your goals.'
      });
    } else if (data.completionRate < 50) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        text: 'Consider breaking down tasks into smaller, manageable chunks.'
      });
    }
    
    // Streak insights
    if (data.currentStreak >= 7) {
      insights.push({
        type: 'success',
        icon: '🔥',
        text: `Amazing ${data.currentStreak}-day streak! Consistency is key to success.`
      });
    } else if (data.currentStreak === 0) {
      insights.push({
        type: 'info',
        icon: '🚀',
        text: 'Start a new streak today! Complete at least one task to begin.'
      });
    }
    
    // Pomodoro insights
    if (data.pomodoroTrend > 0) {
      insights.push({
        type: 'success',
        icon: '🍅',
        text: 'Your focus sessions are increasing! Great momentum.'
      });
    } else if (data.focusTime < 1) {
      insights.push({
        type: 'info',
        icon: '⏱️',
        text: 'Try using the Pomodoro technique to boost your focus time.'
      });
    }
    
    // Pattern-based insights
    if (data.patterns.bestDay) {
      insights.push({
        type: 'info',
        icon: '📊',
        text: `${data.patterns.bestDay.day}s are your most productive days. Schedule important tasks then!`
      });
    }
    
    // Trend insights
    if (data.completionTrend > 10) {
      insights.push({
        type: 'success',
        icon: '📈',
        text: 'Your productivity is trending upward! Keep up the great work.'
      });
    } else if (data.completionTrend < -10) {
      insights.push({
        type: 'warning',
        icon: '📉',
        text: 'Productivity has dipped recently. Consider reviewing your goals and priorities.'
      });
    }
    
    // Default insight if none generated
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        icon: '💡',
        text: 'Keep tracking your progress to unlock personalized insights!'
      });
    }
    
    return insights.slice(0, 4); // Limit to 4 insights
  }

  async refreshAnalytics() {
    if (this.chartContainer) {
      await this.renderDashboard();
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Analytics;
} else {
  window.Analytics = Analytics;
}
