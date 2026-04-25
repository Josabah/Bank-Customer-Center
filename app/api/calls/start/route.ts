import { createCallSession, addCallMessage } from '@/lib/server/calls';
import { jsonError, jsonOk } from '@/lib/server/http';

const INITIAL_PROMPT = 'Hello, welcome to Ethiopian Bank. What is your name?';

export async function POST() {
  try {
    const session = await createCallSession();
    await addCallMessage(session.id, 'agent', INITIAL_PROMPT);

    return jsonOk({
      callSessionId: session.id,
      prompt: INITIAL_PROMPT,
    });
  } catch (error) {
    return jsonError(error);
  }
}
