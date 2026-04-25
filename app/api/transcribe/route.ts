export const runtime = 'nodejs';

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return Response.json({ error: 'Missing GROQ_API_KEY environment variable.' }, { status: 500 });
  }

  const formData = await request.formData();
  const audio = formData.get('audio');

  if (!(audio instanceof File)) {
    return Response.json({ error: 'Missing audio file.' }, { status: 400 });
  }

  const groqFormData = new FormData();
  groqFormData.append('file', audio, audio.name || 'speech.webm');
  groqFormData.append('model', 'whisper-large-v3');
  groqFormData.append('response_format', 'json');
  groqFormData.append('temperature', '0');
  groqFormData.append(
    'prompt',
    [
      'This is a bank call center conversation.',
      'The caller may speak Amharic, English, or a mix of both.',
      'Preserve customer names in Latin characters when they are spoken that way, for example Aymen.',
      'Known customer names include Aymen; if the audio sounds like Amen, Aimen, or Ayman, transcribe it as Aymen.',
      'Preserve PINs and account numbers as digits.',
      'Only transcribe what was spoken; do not invent extra words.',
    ].join(' ')
  );

  const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: groqFormData,
  });

  if (!groqResponse.ok) {
    const error = await groqResponse.text();
    return Response.json({ error }, { status: groqResponse.status });
  }

  const transcription = (await groqResponse.json()) as { text?: string };

  return Response.json({ text: transcription.text?.trim() ?? '' });
}
