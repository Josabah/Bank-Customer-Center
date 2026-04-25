import type { Account, CallSession, Customer, CustomerAuthFactor, Transaction } from './types';

export const DEMO_CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
export const DEMO_ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';

export const demoCustomer: Customer = {
  id: DEMO_CUSTOMER_ID,
  display_name: 'Aymen',
  normalized_name: 'aymen',
};

export const demoAuthFactor: CustomerAuthFactor = {
  customer_id: DEMO_CUSTOMER_ID,
  pin_hash: 'sha256:demo-aymen-pin-salt:ea3af5c7c1da2a3f27424a4ec26fbd26a856aa4c85a2a5b12c01d1a58f3a9842',
  failed_attempt_count: 0,
  locked_until: null,
};

export const demoAccount: Account = {
  id: DEMO_ACCOUNT_ID,
  customer_id: DEMO_CUSTOMER_ID,
  account_type: 'checking',
  currency: 'ETB',
  available_balance: '5200.00',
};

export const demoTransaction: Transaction = {
  id: '33333333-3333-4333-8333-333333333333',
  account_id: DEMO_ACCOUNT_ID,
  amount: '200.00',
  currency: 'ETB',
  description: '200 birr sent',
  posted_at: new Date().toISOString(),
  direction: 'debit',
};

const demoCallSessions = new Map<string, CallSession>();

export function createDemoCallSession(): CallSession {
  const session: CallSession = {
    id: crypto.randomUUID(),
    customer_id: null,
    status: 'active',
    auth_state: 'started',
  };

  demoCallSessions.set(session.id, session);
  return session;
}

export function getDemoCallSession(callSessionId: string) {
  return demoCallSessions.get(callSessionId) ?? null;
}

export function updateDemoCallSession(callSessionId: string, values: Partial<CallSession>) {
  const session = demoCallSessions.get(callSessionId);
  if (!session) return null;

  const nextSession = { ...session, ...values };
  demoCallSessions.set(callSessionId, nextSession);
  return nextSession;
}
