import { addCallMessage } from '@/lib/server/calls';
import { jsonError, jsonOk, readJson } from '@/lib/server/http';
import { messageSchema } from '@/lib/server/schemas';

export async function POST(request: Request) {
  try {
    const body = await readJson(request, messageSchema);
    const message = await addCallMessage(body.callSessionId, body.speaker, body.message);

    return jsonOk({
      messageId: message.id,
    });
  } catch (error) {
    return jsonError(error);
  }
}
