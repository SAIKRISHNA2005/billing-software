import axios from 'axios';

/**
 * Strategy 4: Event-Driven Master Data Cache
 * Caches master lookups in the browser memory during active operator sessions.
 * Invalidates automatically when an entity is created, edited, or deleted,
 * or when the user explicitly triggers a table refresh.
 */

interface MasterCacheStore {
  companies: Array<{ id: string; name: string; [key: string]: any }> | null;
  clients: Array<{ id: string; name: string; [key: string]: any }> | null;
  vendors: Array<{ id: string; name: string; [key: string]: any }> | null;
}

const cacheStore: MasterCacheStore = {
  companies: null,
  clients: null,
  vendors: null,
};

export async function getCachedCompanies(forceRefresh = false) {
  if (!forceRefresh && cacheStore.companies) {
    return cacheStore.companies;
  }
  try {
    const res = await axios.get('/api/master/companies?limit=100');
    if (res.data?.success && res.data.data?.items) {
      cacheStore.companies = res.data.data.items;
      return cacheStore.companies;
    }
  } catch (err) {
    console.error('[MasterCache] Failed to load companies:', err);
  }
  return cacheStore.companies || [];
}

export async function getCachedClients(forceRefresh = false) {
  if (!forceRefresh && cacheStore.clients) {
    return cacheStore.clients;
  }
  try {
    const res = await axios.get('/api/master/clients?limit=100');
    if (res.data?.success && res.data.data?.items) {
      cacheStore.clients = res.data.data.items;
      return cacheStore.clients;
    }
  } catch (err) {
    console.error('[MasterCache] Failed to load clients:', err);
  }
  return cacheStore.clients || [];
}

export async function getCachedVendors(forceRefresh = false) {
  if (!forceRefresh && cacheStore.vendors) {
    return cacheStore.vendors;
  }
  try {
    const res = await axios.get('/api/master/vendors?limit=100');
    if (res.data?.success && res.data.data?.items) {
      cacheStore.vendors = res.data.data.items;
      return cacheStore.vendors;
    }
  } catch (err) {
    console.error('[MasterCache] Failed to load vendors:', err);
  }
  return cacheStore.vendors || [];
}

export function setCachedCompanies(companies: Array<{ id: string; name: string; [key: string]: any }>) {
  if (Array.isArray(companies) && companies.length > 0) {
    cacheStore.companies = companies;
  }
}

export function setCachedClients(clients: Array<{ id: string; name: string; [key: string]: any }>) {
  if (Array.isArray(clients) && clients.length > 0) {
    cacheStore.clients = clients;
  }
}

export function invalidateMasterCache(entity?: 'companies' | 'clients' | 'vendors') {
  if (!entity) {
    cacheStore.companies = null;
    cacheStore.clients = null;
    cacheStore.vendors = null;
  } else {
    cacheStore[entity] = null;
  }
}
