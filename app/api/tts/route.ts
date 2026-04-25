export const runtime = 'nodejs';

import { EdgeTTS } from 'edge-tts-universal';

const DEFAULT_VOICE = 'am-ET-MekdesNeural';
const MAX_TTS_CHARACTERS = 600;
const MAX_CACHE_ENTRIES = 25;
const audioCache = new Map<string, Buffer>();

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

    const voice = body.voice || DEFAULT_VOICE;
    const spokenText = text.slice(0, MAX_TTS_CHARACTERS);
    const cacheKey = `${voice}:${spokenText}`;
    const cachedAudio = audioCache.get(cacheKey);
    const audio = cachedAudio ?? (await synthesizeWithEdge(spokenText, voice));

    if (!cachedAudio) {
      audioCache.set(cacheKey, audio);
      if (audioCache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = audioCache.keys().next().value;
        if (oldestKey) audioCache.delete(oldestKey);
      }
    }

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
