import type { ChargeStatus, FundType, PaymentStatus, VisitType } from './constants';
import type { MembershipRole } from './roles';

export interface Condominium {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
  created_at: string;
}

export interface Unit {
  id: string;
  condominium_id: string;
  cluster_id: string | null;
  identifier: string;
  coefficient: number;
}

export interface Membership {
  id: string;
  user_id: string;
  condominium_id: string;
  unit_id: string | null;
  role: MembershipRole;
  status: 'active' | 'inactive';
}

export interface Charge {
  id: string;
  unit_id: string;
  condominium_id: string;
  amount: number;
  due_date: string;
  status: ChargeStatus;
  concept: string;
  fund_type: FundType;
}

export interface Payment {
  id: string;
  charge_id: string;
  amount: number;
  status: PaymentStatus;
  proof_url: string | null;
  paid_at: string | null;
}

export interface Visit {
  id: string;
  unit_id: string;
  visitor_name: string;
  visit_type: VisitType;
  qr_token: string;
  valid_from: string;
  valid_until: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
}
