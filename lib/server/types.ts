export type Customer = {
  id: string;
  display_name: string;
  normalized_name: string;
};

export type CustomerAuthFactor = {
  customer_id: string;
  pin_hash: string;
  failed_attempt_count: number;
  locked_until: string | null;
};

export type Account = {
  id: string;
  customer_id: string;
  account_type: string;
  currency: string;
  available_balance: string;
};

export type Transaction = {
  id: string;
  account_id: string;
  amount: string;
  currency: string;
  description: string;
  posted_at: string;
  direction: 'credit' | 'debit';
};

export type CallSession = {
  id: string;
  customer_id: string | null;
  status: 'active' | 'ended' | 'handoff';
  auth_state: 'started' | 'identified' | 'authenticated' | 'failed' | 'handoff';
};

export type KnowledgeBaseEntry = {
  id: string;
  title: string;
  body: string;
};
