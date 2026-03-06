const Redis = require('ioredis');

// Use a mock if no REDIS_URL is provided (for local dev without Redis)
const isLocal = !process.env.REDIS_URL;

let redis;
if (isLocal) {
    console.log('Using In-Memory Mock Redis (No Persistent Storage)');
    const store = new Map();
    redis = {
        async get(key) { return store.get(key) || null; },
        async set(key, value) { store.set(key, value); return 'OK'; },
        async del(key) { store.delete(key); return 1; },
        async lpush(key, ...values) {
            if (!store.has(key)) store.set(key, []);
            const list = store.get(key);
            if (!Array.isArray(list)) throw new Error('Key holds non-list value');
            return list.unshift(...values);
        },
        async lrange(key, start, end) {
            if (!store.has(key)) return [];
            const list = store.get(key);
            if (!Array.isArray(list)) return [];
            // handle negative indices like redis
            const len = list.length;
            const s = start < 0 ? Math.max(0, len + start) : start;
            const e = end < 0 ? Math.max(0, len + end) : end;
            return list.slice(s, e + 1);
        },
        async lrem(key, count, value) {
            if (!store.has(key)) return 0;
            const list = store.get(key);
            if (!Array.isArray(list)) return 0;
            let removed = 0;
            let next = [];
            if (count === 0) {
                next = list.filter(item => {
                    if (item === value) {
                        removed += 1;
                        return false;
                    }
                    return true;
                });
            } else if (count > 0) {
                for (const item of list) {
                    if (item === value && removed < count) {
                        removed += 1;
                        continue;
                    }
                    next.push(item);
                }
            } else {
                const reversed = [...list].reverse();
                for (const item of reversed) {
                    if (item === value && removed < Math.abs(count)) {
                        removed += 1;
                        continue;
                    }
                    next.push(item);
                }
                next.reverse();
            }
            store.set(key, next);
            return removed;
        },
        async hset(key, field, value) {
            if (!store.has(key)) store.set(key, new Map());
            const hash = store.get(key);
            if (!(hash instanceof Map)) throw new Error('Key holds non-hash value');
            hash.set(field, value);
            return 1;
        },
        async hgetall(key) {
            if (!store.has(key)) return {};
            const hash = store.get(key);
            if (!(hash instanceof Map)) return {};
            return Object.fromEntries(hash);
        },
        // Add other methods as needed
        async expire(key, seconds) {
            // mock expire (no-op or rudimentary)
            return 1;
        }
    };
} else {
    redis = new Redis(process.env.REDIS_URL);
}

module.exports = redis;
