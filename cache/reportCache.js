const NodeCache = require('node-cache');

const cache = new NodeCache({ 
    stdTTL: 3000,
    checkperiod: 60,
    useClones: false
});

class ReportCache {
    constructor() {
        this.cache = cache;
    }

    generateKey(userId, params = {}) {
        const { page = 1, limit = 10, status, classification, procedureType, fromDate, toDate, search } = params;
        const key = `reports:${userId}:page:${page}:limit:${limit}`;
        
        const filters = [];
        if (status) filters.push(`status:${status}`);
        if (classification) filters.push(`class:${classification}`);
        if (procedureType) filters.push(`proc:${procedureType}`);
        if (fromDate) filters.push(`from:${fromDate}`);
        if (toDate) filters.push(`to:${toDate}`);
        if (search) filters.push(`search:${search}`);
        
        return filters.length > 0 ? `${key}:${filters.join(':')}` : key;
    }

    get(userId, params = {}) {
        const key = this.generateKey(userId, params);
        const cachedData = this.cache.get(key);
        
        if (cachedData) {
            console.log(`Cache hit for key: ${key}`);
            return cachedData;
        }
        
        console.log(`Cache miss for key: ${key}`);
        return null;
    }

    set(userId, params = {}, data, ttl = null) {
        const key = this.generateKey(userId, params);
        
        if (ttl) {
            this.cache.set(key, data, ttl);
        } else {
            this.cache.set(key, data);
        }
        
        console.log(`Cached data for key: ${key}`);
    }

    invalidateUserCache(userId) {
        const keys = this.cache.keys();
        const userKeys = keys.filter(key => key.startsWith(`reports:${userId}`));
        
        userKeys.forEach(key => {
            this.cache.del(key);
            console.log(`Invalidated cache key: ${key}`);
        });
        
        console.log(`Invalidated ${userKeys.length} cache entries for user: ${userId}`);
    }

    invalidateAllReportCache() {
        const keys = this.cache.keys();
        const reportKeys = keys.filter(key => key.includes('reports:') || key.startsWith('reports:'));
        
        if (reportKeys.length > 0) {
            const deleted = this.cache.del(reportKeys);
            console.log(`Invalidated ALL ${deleted} report cache entries`);
            return deleted;
        }
        
        console.log('No report cache entries to invalidate');
        return 0;
    }
}

module.exports = new ReportCache();