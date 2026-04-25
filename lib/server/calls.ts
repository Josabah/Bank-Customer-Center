import { badRequest, notFound, unauthorized } from './errors';
import { supabaseRequest } from '@/lib/supabase/rest';
import type { CallSession } from './types';

export async function createCallSession() {
  const [session] = await supabaseRequest<CallSession[]>('call_sessions', {
    method: 'POST',
    body: [{ status: 'active', auth_state: 'started' }],
    prefer: 'return=representation',
  });

  return session;
}

export async function getCallSession(callSessionId: string) {
  const session = await supabaseRequest<CallSession | null>('call_sessions', {
    query: {
      id: `eq.${callSessionId}`,
      select: 'id,customer_id,status,auth_state',
    },
    maybeSingle: true,
  });

  if (!session) {
    throw notFound('Call session was not found.');
  }

  return session;
}

export async function requireAuthenticatedCall(callSessionId: string) {
  const session = await getCallSession(callSessionId);

  if (session.status !== 'active') {
    throw badRequest('Call session is not active.');
  }

  if (!session.customer_id || session.auth_state !== 'authenticated') {
    throw unauthorized('Call session is not authenticated.');
  }

  return session;
}

export async function updateCallSession(
  callSessionId: string,
  values: Partial<Pick<CallSession, 'customer_id' | 'status' | 'auth_state'> & { handoff_reason: string; ended_at: string }>
) {
  const [session] = await supabaseRequest<CallSession[]>('call_sessions', {
    method: 'PATCH',
    query: {
      id: `eq.${callSessionId}`,
    },
    body: values,
    prefer: 'return=representation',
  });

  return session;
}

export async function addCallMessage(callSessionId: string, speaker: 'user' | 'agent', message: string) {
  await getCallSession(callSessionId);

  const [savedMessage] = await supabaseRequest<{ id: string }[]>('call_messages', {
    method: 'POST',
    body: [{ call_session_id: callSessionId, speaker, message }],
    prefer: 'return=representation',
  });

  return savedMessage;
}
