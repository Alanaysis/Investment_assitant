import { create } from 'zustand';
import type { FundInfo, BacktestResponse } from '@/lib/api';

interface FundStore {
  funds: FundInfo[];
  setFunds: (funds: FundInfo[]) => void;
  addFund: (fund: FundInfo) => void;
  removeFund: (code: string) => void;

  backtestResult: BacktestResponse | null;
  setBacktestResult: (result: BacktestResponse | null) => void;

  selectedFund: string | null;
  setSelectedFund: (code: string | null) => void;

  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useFundStore = create<FundStore>((set) => ({
  funds: [],
  setFunds: (funds) => set({ funds }),
  addFund: (fund) =>
    set((state) => {
      if (state.funds.find((f) => f.fund_code === fund.fund_code)) return state;
      return { funds: [...state.funds, fund] };
    }),
  removeFund: (code) =>
    set((state) => ({ funds: state.funds.filter((f) => f.fund_code !== code) })),

  backtestResult: null,
  setBacktestResult: (result) => set({ backtestResult: result }),

  selectedFund: null,
  setSelectedFund: (code) => set({ selectedFund: code }),

  loading: false,
  setLoading: (loading) => set({ loading }),
}));
