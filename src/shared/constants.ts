/**
 * Shared constants across server and client
 */

export const DEFAULT_PORT = 50234 as const;
export const API_BASE_URL = `http://localhost:${DEFAULT_PORT}`;

// Time constants
export const TWENTY_FOUR_HOURS_MS = 86400000 as const;

// API limits
export const MAX_SESSIONS_LIMIT = 20 as const;
/** Messages returned per session in API responses (client-facing limit) */
export const MAX_MESSAGES_LIMIT = 100 as const;

// Cache TTL
export const POLL_CACHE_TTL_MS = 2000 as const;

// RingBuffer capacity
export const RINGBUFFER_CAPACITY = 1000 as const;

// Session hierarchy depth limit
export const MAX_RECURSION_DEPTH = 10 as const;
