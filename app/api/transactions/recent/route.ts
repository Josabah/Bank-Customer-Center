import { badRequest } from '@/lib/server/errors';
import { getRecentTransaction } from '@/lib/server/accounts';
import { jsonError, jsonOk } from '@/lib/server/http';

export async function GET(request: Request) {
  try {
    const callSessionId = new URL(request.url).searchParams.get('callSessionId');
    if (!callSessionId) {
      throw badRequest('callSessionId is required.');
    }

    const transaction = await getRecentTransaction(callSessionId);

    return jsonOk(transaction);
  } catch (error) {
    return jsonError(error);
  }
}
