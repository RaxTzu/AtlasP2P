'use client';

import { create } from 'zustand';
import type { NodeFilters, NodeStatus, NodeTier } from '@atlasp2p/types';

interface FilterStore {
  filters: NodeFilters;
  setSearch: (search: string) => void;
  setStatus: (status: NodeStatus | undefined) => void;
  setTier: (tier: NodeTier | undefined) => void;
  setCountry: (country: string | undefined) => void;
  setVerifiedOnly: (verified: boolean) => void;
  setSortBy: (sortBy: NodeFilters['sortBy']) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const defaultFilters: NodeFilters = {
  status: undefined,
  country: undefined,
  version: undefined,
  tier: undefined,
  isVerified: undefined,
  search: undefined,
  limit: 1000,
  offset: 0,
  sortBy: 'rank',
  sortOrder: 'asc',
};

export const useFilterStore = create<FilterStore>((set, get) => ({
  filters: defaultFilters,

  setSearch: (search) =>
    set((state) => ({
      filters: { ...state.filters, search: search || undefined },
    })),

  setStatus: (status) =>
    set((state) => ({
      filters: { ...state.filters, status },
    })),

  setTier: (tier) =>
    set((state) => ({
      filters: { ...state.filters, tier },
    })),

  setCountry: (country) =>
    set((state) => ({
      filters: { ...state.filters, country },
    })),

  setVerifiedOnly: (verified) =>
    set((state) => ({
      filters: { ...state.filters, isVerified: verified || undefined },
    })),

  setSortBy: (sortBy) =>
    set((state) => ({
      filters: { ...state.filters, sortBy },
    })),

  setSortOrder: (sortOrder) =>
    set((state) => ({
      filters: { ...state.filters, sortOrder },
    })),

  clearFilters: () =>
    set({
      filters: defaultFilters,
    }),

  get hasActiveFilters() {
    const { filters } = get();
    return !!(
      filters.search ||
      filters.status ||
      filters.tier ||
      filters.country ||
      filters.isVerified
    );
  },
}));
