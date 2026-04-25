export const runtime = 'nodejs';

type ChatMessage = {
  speaker: 'agent' | 'user';
  text: string;
};

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const BANK_CONTEXT = `
You are an Amharic-speaking customer support voice assistant for an Ethiopian bank.
Answer mainly in natural Amharic. Keep replies concise because they will be spoken aloud.
You can help with general banking questions, product information, branch/service guidance, and safe troubleshooting.
Do not invent account data, balances, transactions, exchange rates, fees, or bank policies.
For sensitive account actions, identity verification, disputed transactions, lost cards, or anything requiring private customer data, say you will connect the customer to a human agent.
`;

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return Response.json({ error: 'Missing GROQ_API_KEY environment variable.' }, { status: 500 });
  }

  const body = (await request.json()) as {
    messages?: ChatMessage[];
    knowledgeBase?: string;
  };

  const conversation = (body.messages ?? []).slice(-12).map((message) => ({
    role: message.speaker === 'user' ? 'user' : 'assistant',
    content: message.text,
  }));

  const knowledgeBase = body.knowledgeBase?.trim()
    ? `\nKnowledge base supplied by the bank:\n${body.knowledgeBase.trim().slice(0, 6000)}`
    : '';

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `${BANK_CONTEXT}${knowledgeBase}`,
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
