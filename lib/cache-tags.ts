/**
 * Cache tags shared between the code that populates ISR / data-cache entries
 * (page routes) and the code that purges them (publish). Kept dependency-free
 * so page bundles don't pull in the cache service.
 */

/**
 * Tag for the site-wide global settings data-cache entry (published_at,
 * custom code, favicon…). Lets a selective publish refresh it without
 * purging every page.
 */
export const GLOBAL_SETTINGS_TAG = 'global-settings';
