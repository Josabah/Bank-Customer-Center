import { identifyCustomer } from '@/lib/server/auth';
import { addCallMessage } from '@/lib/server/calls';
import { jsonError, jsonOk, readJson } from '@/lib/server/http';
import { identifySchema } from '@/lib/server/schemas';

export async function POST(request: Request) {
  try {
    const body = await readJson(request, identifySchema);
    const customer = await identifyCustomer(body.callSessionId, body.transcript);
    const prompt =
      body.language === 'am'
        ? `እናመሰግናለን ${customer.display_name}። እባክዎ ፒንዎን ይናገሩ።`
        : `Thank you, ${customer.display_name}. Please say your PIN.`;

    await addCallMessage(body.callSessionId, 'user', body.transcript);
    await addCallMessage(body.callSessionId, 'agent', prompt);

    return jsonOk({
      customerId: customer.id,
      displayName: customer.display_name,
      prompt,
    });
  } catch (error) {
    return jsonError(error);
  }
}
