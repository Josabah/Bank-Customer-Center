import { badRequest } from '@/lib/server/errors';
import { getAccountSummary } from '@/lib/server/accounts';
import { jsonError, jsonOk } from '@/lib/server/http';

export async function GET(request: Request) {
  try {
    const callSessionId = new URL(request.url).searchParams.get('callSessionId');
    if (!callSessionId) {
      throw badRequest('callSessionId is required.');
    }

    const summary = await getAccountSummary(callSessionId);

    return jsonOk(summary);
  } catch (error) {
    return jsonError(error);
  }
}
