const NodeCache = require('node-cache');

class AppointmentCache {
  constructor() {
    this.cache = new NodeCache({ 
      stdTTL: 3000,
      checkperiod: 60,
      useClones: false
    });
  }

  generateKey(userId, filters = {}) {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      consultationMode, 
      fromDate, 
      toDate, 
      search 
    } = filters;
    
    const key = `appointments:${userId}:page:${page}:limit:${limit}:status:${status || 'all'}:mode:${consultationMode || 'all'}:from:${fromDate || 'none'}:to:${toDate || 'none'}:search:${search || 'none'}`;
    return key.replace(/[:\s]/g, '_').replace(/[\[\]{}()]/g, '');
  }

  get(userId, filters = {}) {
    const key = this.generateKey(userId, filters);
    const cachedData = this.cache.get(key);
    
    if (cachedData) {
      console.log(`Cache HIT for user ${userId}`);
      return cachedData;
    }
    
    console.log(`Cache MISS for user ${userId}`);
    return null;
  }

  set(userId, filters = {}, data, ttl = null) {
    const key = this.generateKey(userId, filters);
    let success;
    
    if (ttl) {
      success = this.cache.set(key, data, ttl);
    } else {
      success = this.cache.set(key, data);
    }
    
    if (success) {
      console.log(`Cache SET for user ${userId}`);
    }
    
    return success;
  }

  invalidateUserCache(userId) {
    try {
      const keys = this.cache.keys();
      const userKeys = keys.filter(key => key.includes(`_${userId}_`) || key.includes(`:${userId}:`));
      
      if (userKeys.length > 0) {
        const deleted = this.cache.del(userKeys);
        console.log(`Invalidated ${deleted} cache entries for user ${userId}`);
        return deleted;
      }
      
      return 0;
    } catch (error) {
      console.error('Error invalidating cache:', error);
      return 0;
    }
  }

  invalidateAllAppointmentCache() {
    try {
      const keys = this.cache.keys();
      // Filter keys that are related to appointments
      const appointmentKeys = keys.filter(key => key.includes('appointments_') || key.includes('appointments:'));
      
      if (appointmentKeys.length > 0) {
        const deleted = this.cache.del(appointmentKeys);
        console.log(`Invalidated ALL ${deleted} appointment cache entries`);
        return deleted;
      }
      
      console.log('No appointment cache entries to invalidate');
      return 0;
    } catch (error) {
      console.error('Error invalidating all appointment cache:', error);
      return 0;
    }
  }

  getStats() {
    const stats = this.cache.getStats();
    return {
      keys: this.cache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
      ksize: stats.ksize,
      vsize: stats.vsize
    };
  }
}

// Create a singleton instance
const appointmentCache = new AppointmentCache();

module.exports = appointmentCache;