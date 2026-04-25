import { supabaseRequest } from '@/lib/supabase/rest';

import { badRequest, notFound, unauthorized } from './errors';
import { verifyPin } from './pin';
import { getCallSession, updateCallSession } from './calls';
import type { Customer, CustomerAuthFactor } from './types';

const MAX_FAILED_PIN_ATTEMPTS = 3;
const LOCK_MINUTES = 10;

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

export async function identifyCustomer(callSessionId: string, transcript: string) {
  await getCallSession(callSessionId);

  const normalizedTranscript = normalizeName(transcript);
  if (!normalizedTranscript) {
    throw badRequest('Could not identify a customer from that transcript.');
  }

  const customers = await supabaseRequest<Customer[]>('customers', {
    query: {
      select: 'id,display_name,normalized_name',
      limit: 20,
    },
  });

  const customer = customers.find(
    (candidate) => nameMatches(normalizedTranscript, candidate.normalized_name)
  );
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

  const authFactor = await supabaseRequest<CustomerAuthFactor | null>('customer_auth_factors', {
    query: {
      customer_id: `eq.${customerId}`,
      select: 'customer_id,pin_hash,failed_attempt_count,locked_until',
    },
    maybeSingle: true,
  });

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

    await updateCallSession(callSessionId, {
      auth_state: 'failed',
    });

    throw unauthorized('PIN is incorrect.');
  }

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

  await updateCallSession(callSessionId, {
    auth_state: 'authenticated',
  });

  return { authenticated: true };
}
