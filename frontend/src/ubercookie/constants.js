// Shared names/keys under which the ubercookie id is planted in each vector.
export const STORAGE_KEY = 'ubercookie_id';
export const COOKIE_KEY = 'gc_uid';
export const CACHE_NAME = 'ubercookie';
export const CACHE_API_URL = '/__ubercookie_cacheapi_id';
export const WINDOW_NAME_PREFIX = 'ubercookie:';

// Header the server reads to (re)stamp its ETag / embedded-id-script vectors.
export const SET_HEADER = 'X-Ubercookie-Set';

// One year, for cookie lifetimes.
export const ONE_YEAR = 60 * 60 * 24 * 365;
