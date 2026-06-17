export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      memberships: {
        Row: {
          id: string;
          user_id: string;
          condominium_id: string;
          unit_id: string | null;
          role: string;
          status: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      charges: {
        Row: {
          id: string;
          concept: string;
          amount: number;
          due_date: string;
          status: string;
          fund_type: string;
          unit_id: string;
          condominium_id: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      payments: {
        Row: {
          id: string;
          charge_id: string;
          condominium_id: string;
          unit_id: string;
          amount: number;
          status: string;
          proof_url: string | null;
          created_at: string;
        };
        Insert: {
          charge_id: string;
          condominium_id: string;
          unit_id: string;
          amount: number;
          proof_url?: string | null;
          payment_method?: string | null;
          paid_at?: string | null;
        };
        Update: Record<string, unknown>;
        Relationships: [];
      };
      fund_balances: {
        Row: { fund_type: string; balance: number };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      expenses: {
        Row: {
          id: string;
          concept: string;
          amount: number;
          category: string;
          expense_date: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      condominiums: {
        Row: { id: string; name: string; slug: string };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      units: {
        Row: { id: string; identifier: string };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      invitations: {
        Row: {
          id: string;
          email: string;
          role: string;
          status: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      accept_pending_invitations: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
