import { verifyCustomerPin } from '@/lib/server/auth';
import { addCallMessage } from '@/lib/server/calls';
import { jsonError, jsonOk, readJson } from '@/lib/server/http';
import { verifyPinSchema } from '@/lib/server/schemas';

export async function POST(request: Request) {
  try {
    const body = await readJson(request, verifyPinSchema);
    await verifyCustomerPin(body.callSessionId, body.customerId, body.pin);

    const prompt =
      body.language === 'am'
        ? 'እንኳን ደህና መጡ። ማንነትዎ ተረጋግጧል። ስለ ቀሪ ሂሳብ፣ የቅርብ ግብይት፣ ወይም ሌሎች የባንክ ጥያቄዎች መጠየቅ ይችላሉ።'
        : 'Welcome back. You are verified. You can ask for your balance, recent transaction, mobile banking help, card support, or any general banking question.';

    await addCallMessage(body.callSessionId, 'user', '[PIN entered]');
    await addCallMessage(body.callSessionId, 'agent', prompt);

    return jsonOk({
      authenticated: true,
      prompt,
    });
  } catch (error) {
    return jsonError(error);
  }
}
