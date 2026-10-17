import { AsyncLocalStorage } from 'node:async_hooks';

export type CacheState = 'HIT' | 'MISS' | 'BYPASS';

interface RequestContext {
	cache?: CacheState;
	cacheKey?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
	return requestContextStorage.getStore() ?? {};
}

export function setCacheState(state: CacheState, key?: string): void {
	const store = requestContextStorage.getStore();
	if (!store) return;
	store.cache = state;
	if (key) store.cacheKey = key;
}
