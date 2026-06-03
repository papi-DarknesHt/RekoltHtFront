import { create } from "zustand";

export const useGlobalStore = create((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),

  dispatch: ({ type, data }) => {
    set((state) => {
      switch (type) {
        default: return state;
      }
    });
  },
}));