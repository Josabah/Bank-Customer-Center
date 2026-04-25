import { badRequest, notFound, unauthorized } from './errors';
import { supabaseRequest } from '@/lib/supabase/rest';
import { createDemoCallSession, getDemoCallSession, updateDemoCallSession } from './demo-data';
import type { CallSession } from './types';

export async function createCallSession() {
  try {
    const [session] = await supabaseRequest<CallSession[]>('call_sessions', {
      method: 'POST',
      body: [{ status: 'active', auth_state: 'started' }],
      prefer: 'return=representation',
    });

    return session;
  } catch (error) {
    console.warn('Supabase unavailable; starting demo call session locally.', error);
    return createDemoCallSession();
  }
}

export async function getCallSession(callSessionId: string) {
  const demoSession = getDemoCallSession(callSessionId);
  if (demoSession) return demoSession;

  let session: CallSession | null = null;
  try {
    session = await supabaseRequest<CallSession | null>('call_sessions', {
      query: {
        id: `eq.${callSessionId}`,
        select: 'id,customer_id,status,auth_state',
      },
      maybeSingle: true,
    });
  } catch (error) {
    console.warn('Supabase unavailable while loading call session.', error);
  }

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
  const demoSession = updateDemoCallSession(callSessionId, values);
  if (demoSession) return demoSession;

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
  const session = await getCallSession(callSessionId);
  if (getDemoCallSession(session.id)) {
    return { id: crypto.randomUUID() };
  }

  const [savedMessage] = await supabaseRequest<{ id: string }[]>('call_messages', {
    method: 'POST',
    body: [{ call_session_id: callSessionId, speaker, message }],
    prefer: 'return=representation',
  });

  return savedMessage;
}
