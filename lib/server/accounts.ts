import { supabaseRequest } from '@/lib/supabase/rest';

import { notFound } from './errors';
import { requireAuthenticatedCall } from './calls';
import { demoAccount, demoTransaction } from './demo-data';
import type { Account, Transaction } from './types';

function formatCurrency(amount: string, currency: string) {
  const number = Number(amount);
  const formatted = Number.isFinite(number)
    ? new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(number)
    : amount;

  return currency === 'ETB' ? `${formatted} birr` : `${formatted} ${currency}`;
}

export async function getAccountSummary(callSessionId: string) {
  const session = await requireAuthenticatedCall(callSessionId);
  let accounts: Account[] = [];

  try {
    accounts = await supabaseRequest<Account[]>('accounts', {
      query: {
        customer_id: `eq.${session.customer_id}`,
        select: 'id,customer_id,account_type,currency,available_balance',
        limit: 1,
      },
    });
  } catch (error) {
    console.warn('Supabase unavailable while loading account summary; using demo account.', error);
    if (session.customer_id === demoAccount.customer_id) {
      accounts = [demoAccount];
    }
  }

  const account = accounts[0];
  if (!account) {
    throw notFound('No account was found for this customer.');
  }

  return {
    accountId: account.id,
    accountType: account.account_type,
    balance: formatCurrency(account.available_balance, account.currency),
  };
}

export async function getRecentTransaction(callSessionId: string) {
  const summary = await getAccountSummary(callSessionId);
  let transactions: Transaction[] = [];

  try {
    transactions = await supabaseRequest<Transaction[]>('transactions', {
      query: {
        account_id: `eq.${summary.accountId}`,
        select: 'id,account_id,amount,currency,description,posted_at,direction',
        order: 'posted_at.desc',
        limit: 1,
      },
    });
  } catch (error) {
    console.warn('Supabase unavailable while loading recent transaction; using demo transaction.', error);
    if (summary.accountId === demoTransaction.account_id) {
      transactions = [demoTransaction];
    }
  }

  const transaction = transactions[0];
  if (!transaction) {
    throw notFound('No recent transaction was found for this account.');
  }

  return {
    transactionId: transaction.id,
    description: transaction.description,
    amount: formatCurrency(transaction.amount, transaction.currency),
    direction: transaction.direction,
    postedAt: transaction.posted_at,
  };
}
