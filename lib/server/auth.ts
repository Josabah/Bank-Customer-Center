import { supabaseRequest } from '@/lib/supabase/rest';

import { badRequest, notFound, unauthorized } from './errors';
import { verifyPin } from './pin';
import { getCallSession, updateCallSession } from './calls';
import { demoAuthFactor, demoCustomer } from './demo-data';
import type { Customer, CustomerAuthFactor } from './types';

const MAX_FAILED_PIN_ATTEMPTS = 3;
const LOCK_MINUTES = 10;
const DEMO_CUSTOMER_NAMES = ['aymen', 'amen', 'aimen', 'ayman', 'aiman', 'eymen'];
const AMHARIC_DEMO_NAME_CUES = ['አይመን', 'አይሜን', 'ኤመን', 'አመን'];
const INTRODUCTION_CUES = ['my name', 'name is', 'i am', 'i m', 'im ', 'this is', 'called'];

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function pronunciationKey(value: string) {
  return normalizeName(value)
    .replace(/\bai/g, 'a')
    .replace(/\bay/g, 'a')
    .replace(/y/g, '')
    .replace(/\s+/g, '');
}

function nameMatches(transcript: string, customerName: string) {
  const normalizedTranscript = normalizeName(transcript);
  const normalizedCustomerName = normalizeName(customerName);
  const transcriptKey = pronunciationKey(transcript);
  const customerKey = pronunciationKey(customerName);

  return (
    normalizedTranscript.includes(normalizedCustomerName) ||
    normalizedCustomerName.includes(normalizedTranscript) ||
    (!!transcriptKey && !!customerKey && (transcriptKey.includes(customerKey) || customerKey.includes(transcriptKey)))
  );
}

function findDemoFallbackCustomer(customers: Customer[], transcript: string) {
  const normalizedTranscript = normalizeName(transcript);
  const transcriptKey = pronunciationKey(normalizedTranscript);
  const demoCustomer = customers.find((customer) =>
    DEMO_CUSTOMER_NAMES.includes(normalizeName(customer.normalized_name))
  );

  if (!demoCustomer) return null;

  if (AMHARIC_DEMO_NAME_CUES.some((name) => transcript.includes(name))) {
    return demoCustomer;
  }

  const hasKnownDemoName = DEMO_CUSTOMER_NAMES.some((name) => {
    const key = pronunciationKey(name);
    return normalizedTranscript.includes(name) || transcriptKey.includes(key) || key.includes(transcriptKey);
  });

  if (hasKnownDemoName) {
    return demoCustomer;
  }

  const soundsLikeIntroduction = INTRODUCTION_CUES.some((cue) => normalizedTranscript.includes(cue));
  if (soundsLikeIntroduction && normalizedTranscript.split(' ').length <= 12) {
    return demoCustomer;
  }

  return null;
}

export async function identifyCustomer(callSessionId: string, transcript: string) {
  await getCallSession(callSessionId);

  const normalizedTranscript = normalizeName(transcript);

  let customers: Customer[] = [demoCustomer];
  try {
    customers = await supabaseRequest<Customer[]>('customers', {
      query: {
        select: 'id,display_name,normalized_name',
        limit: 20,
      },
    });
  } catch (error) {
    console.warn('Supabase unavailable while identifying customer; using demo customer data.', error);
  }

  const customer = customers.find(
    (candidate) => nameMatches(normalizedTranscript, candidate.normalized_name)
  ) ?? findDemoFallbackCustomer(customers, transcript);

  if (!normalizedTranscript && !customer) {
    throw badRequest('Could not identify a customer from that transcript.');
  }

  if (!customer) {
    await updateCallSession(callSessionId, {
      status: 'handoff',
      auth_state: 'handoff',
      handoff_reason: 'customer_not_found',
    });
    throw notFound('Customer was not found.');
  }

  await updateCallSession(callSessionId, {
    customer_id: customer.id,
    auth_state: 'identified',
  });

  return customer;
}

export async function verifyCustomerPin(callSessionId: string, customerId: string, pinTranscript: string) {
  const session = await getCallSession(callSessionId);

  if (session.customer_id !== customerId) {
    throw unauthorized('Customer does not match the active call session.');
  }

  let authFactor: CustomerAuthFactor | null = null;
  try {
    authFactor = await supabaseRequest<CustomerAuthFactor | null>('customer_auth_factors', {
      query: {
        customer_id: `eq.${customerId}`,
        select: 'customer_id,pin_hash,failed_attempt_count,locked_until',
      },
      maybeSingle: true,
    });
  } catch (error) {
    console.warn('Supabase unavailable while verifying PIN; using demo auth factor.', error);
    if (customerId === demoAuthFactor.customer_id) {
      authFactor = demoAuthFactor;
    }
  }

  if (!authFactor) {
    throw notFound('Customer PIN factor was not found.');
  }

  if (authFactor.locked_until && new Date(authFactor.locked_until) > new Date()) {
    throw unauthorized('PIN verification is temporarily locked.');
  }

  const digits = pinTranscript.replace(/\D/g, '');

  if (!verifyPin(digits, authFactor.pin_hash)) {
    const failedAttemptCount = authFactor.failed_attempt_count + 1;
    const lockedUntil =
      failedAttemptCount >= MAX_FAILED_PIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null;

    try {
      await supabaseRequest('customer_auth_factors', {
        method: 'PATCH',
        query: {
          customer_id: `eq.${customerId}`,
        },
        body: {
          failed_attempt_count: failedAttemptCount,
          locked_until: lockedUntil,
        },
      });
    } catch (error) {
      console.warn('Supabase unavailable while recording failed PIN attempt.', error);
    }

    await updateCallSession(callSessionId, {
      auth_state: 'failed',
    });

    throw unauthorized('PIN is incorrect.');
  }

  try {
    await supabaseRequest('customer_auth_factors', {
      method: 'PATCH',
      query: {
        customer_id: `eq.${customerId}`,
      },
      body: {
        failed_attempt_count: 0,
        locked_until: null,
      },
    });
  } catch (error) {
    console.warn('Supabase unavailable while clearing PIN attempts.', error);
  }

  await updateCallSession(callSessionId, {
    auth_state: 'authenticated',
  });

  return { authenticated: true };
}
