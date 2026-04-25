import { updateCallSession } from '@/lib/server/calls';
import { jsonError, jsonOk, readJson } from '@/lib/server/http';
import { callSessionSchema } from '@/lib/server/schemas';

export async function POST(request: Request) {
  try {
    const body = await readJson(request, callSessionSchema);

    await updateCallSession(body.callSessionId, {
      status: 'ended',
      ended_at: new Date().toISOString(),
    });

    return jsonOk({ ended: true });
  } catch (error) {
    return jsonError(error);
  }
}
