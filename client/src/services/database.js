// src/services/database.js

// 🟢 1. SETTINGS REPOSITORY
export const SettingsRepository = {
  set: (key, value) => {
    localStorage.setItem(`settings_${key}`, value);
  },
  get: (key) => {
    return localStorage.getItem(`settings_${key}`);
  },
};

// 🟢 2. CHILD REPOSITORY
export const ChildRepository = {
  create: (name) => {
    const id = Date.now().toString();
    // Get existing children, or an empty array if none exist
    const existing = JSON.parse(localStorage.getItem('children_table') || '[]');
    
    existing.push({ id, name, created_at: Date.now() });
    localStorage.setItem('children_table', JSON.stringify(existing));
    
    return id;
  },

  getFirstChild: () => {
    const existing = JSON.parse(localStorage.getItem('children_table') || '[]');
    if (existing.length > 0) {
      return existing[0];
    }
    return null;
  },
};

// 🟢 3. SESSION REPOSITORY
export const SessionRepository = {
  create: (session) => {
    try {
      const existing = SessionRepository.getAllAsArray();
      existing.push(session);
      localStorage.setItem('sessions_history', JSON.stringify(existing));
      console.log(`💾 Session saved: ${session.id} (Completed: ${session.completed})`);
    } catch (e) {
      console.error('Failed to save session', e);
    }
  },

  getAllAsArray: () => {
    try {
      const data = localStorage.getItem('sessions_history');
      if (data) {
        const parsed = JSON.parse(data);
        // Return sorted by start_time descending (newest first)
        return parsed.sort((a, b) => b.start_time - a.start_time);
      }
    } catch (e) {
      console.error('Failed to parse sessions', e);
    }
    return [];
  },
};