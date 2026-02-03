/**
 * Shared constants across server and client
 */

export const DEFAULT_PORT = 50234;
export const API_BASE_URL = `http://localhost:${DEFAULT_PORT}`;

// Time constants
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// API limits
export const MAX_SESSIONS_LIMIT = 20;
export const MAX_MESSAGES_LIMIT = 100;

// Cache TTL
export const CACHE_TTL_MS = 2000;
export const POLL_CACHE_TTL_MS = 2000;

// RingBuffer capacity
export const RINGBUFFER_CAPACITY = 1000;

// Session hierarchy depth limit
export const MAX_RECURSION_DEPTH = 10;
