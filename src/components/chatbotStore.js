import { create } from "zustand";

// Contexte optionnel pour la bulle de conseils (ChatbotVendeur.jsx), montée
// une seule fois globalement dans App.jsx pour rester disponible sur toutes
// les pages. Une page qui a un conseil contextuel à afficher (ex: le wizard
// DevenirVendeur.jsx pendant ses étapes) met à jour ce store ; les autres
// pages laissent etape/statut à null et le chatbot affiche un conseil générique.
export const useChatbotStore = create((set) => ({
  etape: null,
  statut: null,
  setContexte: (etape, statut) => set({ etape: etape ?? null, statut: statut ?? null }),
}));
