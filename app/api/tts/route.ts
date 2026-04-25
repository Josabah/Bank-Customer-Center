export const runtime = 'nodejs';

import { EdgeTTS } from 'edge-tts-universal';

const DEFAULT_VOICE = 'am-ET-MekdesNeural';

async function synthesizeWithEdge(text: string, voice: string) {
  const tts = new EdgeTTS(text, voice);
  const result = await tts.synthesize();

  return Buffer.from(await result.audio.arrayBuffer());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      text?: string;
      voice?: string;
    };
    const text = body.text?.trim();

    if (!text) {
      return Response.json({ error: 'Missing text.' }, { status: 400 });
    }

    const audio = await synthesizeWithEdge(text.slice(0, 1000), body.voice || DEFAULT_VOICE);

    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(error);

    return Response.json({ error: 'Edge TTS failed.' }, { status: 502 });
  }
}
