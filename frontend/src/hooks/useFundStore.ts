import { create } from 'zustand';
import type { FundInfo } from '@/lib/api';

interface FundStore {
  funds: FundInfo[];
  setFunds: (funds: FundInfo[]) => void;
}

export const useFundStore = create<FundStore>((set) => ({
  funds: [],
  setFunds: (funds) => set({ funds }),
}));
