export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
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
        'This is a live bank customer support call.',
        'The assistant first asks for the customer name, then asks for a PIN, then answers banking questions.',
        'The caller may speak Amharic, English, or a mix of both.',
        'Do not translate the caller. Transcribe exactly what the caller said.',
        'Preserve customer names in Latin characters when they are spoken that way.',
        'Known demo customer names include Aymen, Amen, Aimen, Ayman, Eymen, and Eyob. If the audio sounds close to Aymen, transcribe the name as Aymen.',
        'If the caller says "my name is Aymen", "I am Aymen", "this is Aymen", or similar, keep the name Aymen clearly in the transcript.',
        'Preserve PINs and account numbers as digits. If the caller says one two three four, transcribe it as 1234.',
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
      return Response.json(
        { error: error || 'Groq transcription request failed.' },
        { status: groqResponse.status }
      );
    }

    const transcription = (await groqResponse.json()) as { text?: string };

    return Response.json({ text: transcription.text?.trim() ?? '' });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error && error.message.includes('fetch failed')
        ? 'Transcription service timed out. Please try recording again.'
        : 'Transcription failed. Please try recording again.';

    return Response.json({ error: message }, { status: 502 });
  }
}
