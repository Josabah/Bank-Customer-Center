export const runtime = 'nodejs';

type ChatMessage = {
  speaker: 'agent' | 'user';
  text: string;
};

type SessionLanguage = 'en' | 'am';

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const BANK_CONTEXT = `
You are Selam, a professional voice assistant for an Ethiopian bank customer support center.

Your job:
- Help callers with general banking questions in a calm, polite, call-center style.
- Keep answers to one or two short sentences because they will be spoken aloud.
- Prefer clear English if the caller uses English, Amharic if the caller uses Amharic, and simple bilingual support if the caller mixes languages.
- Sound like a bank representative, not a generic chatbot.
- Ask one clarifying question only when it is needed.

Authentication and safety:
- Never invent private account data, balances, transactions, PINs, account numbers, fees, exchange rates, or policies.
- If the caller asks for personal account data, transfers, card blocking, PIN reset, disputed transactions, or identity-sensitive actions, explain that identity verification or a human agent is required.
- If the caller is not authenticated, you may still answer public questions about services, banking hours, digital banking, ATM usage, cards, loans, savings, fees in general terms, and safety tips.
- Never ask the caller to say their full card number, full account number, or PIN inside a general AI answer.

Demo bank knowledge you may use for public questions:
- The bank supports savings accounts, checking accounts, debit cards, mobile banking, ATM withdrawals, branch deposits, and basic customer support.
- Customers can ask for balance and recent transactions only after name and PIN verification.
- Demo customer: Aymen. Demo PIN for presentations: 1234. Demo balance: 5,200 birr. Demo recent transaction: 200 birr sent.
- For mobile banking help, advise the caller to check internet access, verify their phone number is registered, restart the app, and contact support if the issue continues.
- For lost cards or suspected fraud, tell the caller this is sensitive and should be handled by a human agent immediately.
- For branch or service information, give general guidance and explain that exact branch hours can vary.
`;

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return Response.json({ error: 'Missing GROQ_API_KEY environment variable.' }, { status: 500 });
  }

  const body = (await request.json()) as {
    messages?: ChatMessage[];
    knowledgeBase?: string;
    language?: SessionLanguage;
  };

  const conversation = (body.messages ?? []).slice(-12).map((message) => ({
    role: message.speaker === 'user' ? 'user' : 'assistant',
    content: message.text,
  }));

  const knowledgeBase = body.knowledgeBase?.trim()
    ? `\nKnowledge base supplied by the bank:\n${body.knowledgeBase.trim().slice(0, 6000)}`
    : '';
  const languageInstruction =
    body.language === 'am'
      ? '\nSession language: Amharic. Reply only in natural Amharic unless the caller explicitly asks to switch languages.'
      : '\nSession language: English. Reply only in clear English unless the caller explicitly asks to switch languages.';

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 180,
      messages: [
        {
          role: 'system',
          content: `${BANK_CONTEXT}${knowledgeBase}${languageInstruction}`,
        },
        ...conversation,
      ],
    }),
  });

  if (!groqResponse.ok) {
    const error = await groqResponse.text();
    return Response.json({ error }, { status: groqResponse.status });
  }

  const completion = (await groqResponse.json()) as GroqChatResponse;
  const text = completion.choices?.[0]?.message?.content?.trim();

  return Response.json({
    text:
      text ||
      'ይቅርታ፣ አሁን መልስ መስጠት አልቻልኩም። እባክዎ እንደገና ይሞክሩ።',
  });
}
