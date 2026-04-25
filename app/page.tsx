'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Message = {
  speaker: 'agent' | 'user';
  text: string;
};

type JsonResponse<T> = T & {
  error?: string | { message?: string };
};

type CallState = 'IDLE' | 'ASK_NAME' | 'ASK_PIN' | 'MENU';

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as JsonResponse<T>;

  if (!response.ok) {
    const error = typeof payload.error === 'string' ? payload.error : payload.error?.message;
    throw new Error(error || 'Request failed.');
  }

  return payload;
}

export default function Home() {
  const [callActive, setCallActive] = useState(false);
  const [callTimer, setCallTimer] = useState('00:00');
  const [messages, setMessages] = useState<Message[]>([]);
  const [listeningStatus, setListeningStatus] = useState('');
  const [kbStatus] = useState('Knowledge base is managed in Supabase.');
  const [userMessage, setUserMessage] = useState('');
  const [showUserMessage, setShowUserMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const callSessionIdRef = useRef<string | null>(null);
  const currentCustomerIdRef = useRef<string | null>(null);
  const currentCustomerNameRef = useRef<string | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef<CallState>('IDLE');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const addMessage = useCallback((speaker: Message['speaker'], text: string) => {
    setMessages((prev) => [...prev, { speaker, text }]);
  }, []);

  const saveMessage = useCallback(async (speaker: Message['speaker'], message: string) => {
    if (!callSessionIdRef.current) return;

    try {
      await fetch('/api/calls/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSessionId: callSessionIdRef.current,
          speaker,
          message,
        }),
      });
    } catch (error) {
      console.error(error);
    }
  }, []);

  const cleanupAudioUrl = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const agentSpeak = useCallback(
    async (text: string, persist = true) => {
      addMessage('agent', text);
      if (persist) void saveMessage('agent', text);
      setListeningStatus('Speaking with Edge TTS...');
      setIsSpeaking(true);

      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: 'am-ET-MekdesNeural' }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || 'Edge TTS failed.');
        }

        const audioBlob = await response.blob();
        cleanupAudioUrl();
        const url = URL.createObjectURL(audioBlob);
        audioUrlRef.current = url;

        if (!audioRef.current) {
          setIsSpeaking(false);
          return;
        }

        audioRef.current.src = url;
        await audioRef.current.play();
      } catch (error) {
        setIsSpeaking(false);
        setListeningStatus(
          error instanceof Error ? `TTS error: ${error.message}` : 'TTS error.'
        );
      }
    },
    [addMessage, saveMessage]
  );

  const askGroq = useCallback(
    async (nextMessages: Message[], knowledgeBase?: string) => {
      setIsBusy(true);
      setListeningStatus('Thinking with Groq Llama 3.3 70B...');

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextMessages,
            knowledgeBase,
          }),
        });
        const payload = await readJson<{ text: string }>(response);
        await agentSpeak(payload.text);
      } catch (error) {
        await agentSpeak(
          error instanceof Error
            ? `ይቅርታ፣ የGroq መልስ ማግኘት አልተቻለም፦ ${error.message}`
            : 'ይቅርታ፣ የGroq መልስ ማግኘት አልተቻለም።'
        );
      } finally {
        setIsBusy(false);
      }
    },
    [agentSpeak]
  );

  const handleUserTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript) {
        setListeningStatus('No speech detected.');
        return;
      }

      setUserMessage(transcript);
      setShowUserMessage(true);

      const nextMessages: Message[] = [...messages, { speaker: 'user', text: transcript }];
      setMessages(nextMessages);

      if (stateRef.current === 'ASK_NAME') {
        try {
          const response = await fetch('/api/auth/identify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callSessionId: callSessionIdRef.current,
              transcript,
            }),
          });
          const payload = await readJson<{
            customerId: string;
            displayName: string;
            prompt: string;
          }>(response);

          currentCustomerIdRef.current = payload.customerId;
          currentCustomerNameRef.current = payload.displayName;
          stateRef.current = 'ASK_PIN';
          await agentSpeak(payload.prompt, false);
        } catch {
          stateRef.current = 'MENU';
          await agentSpeak(
            'I could not find that customer. I will connect you to a human agent.'
          );
        }
        return;
      }

      if (stateRef.current === 'ASK_PIN') {
        try {
          const response = await fetch('/api/auth/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callSessionId: callSessionIdRef.current,
              customerId: currentCustomerIdRef.current,
              pin: transcript,
            }),
          });
          const payload = await readJson<{ authenticated: boolean; prompt: string }>(response);

          if (payload.authenticated) {
            stateRef.current = 'MENU';
            const name = currentCustomerNameRef.current ?? 'customer';
            await agentSpeak(payload.prompt.replace('Welcome back.', `Welcome back, ${name}.`), false);
          }
        } catch {
          stateRef.current = 'MENU';
          await agentSpeak('That PIN is incorrect. I will connect you to a human agent.');
        }
        return;
      }

      if (!callSessionIdRef.current || !currentCustomerIdRef.current) {
        await agentSpeak('There was an authentication issue. I will connect you to a human agent.');
        return;
      }

      await saveMessage('user', transcript);

      const lowerTranscript = transcript.toLowerCase();
      if (lowerTranscript.includes('balance')) {
        const response = await fetch(`/api/accounts/summary?callSessionId=${callSessionIdRef.current}`);
        const payload = await readJson<{ balance: string }>(response);
        await agentSpeak(`Your current account balance is ${payload.balance}.`);
        return;
      }

      if (lowerTranscript.includes('transaction') || lowerTranscript.includes('recent')) {
        const response = await fetch(
          `/api/transactions/recent?callSessionId=${callSessionIdRef.current}`
        );
        const payload = await readJson<{ description: string }>(response);
        await agentSpeak(`Your most recent transaction is: ${payload.description}.`);
        return;
      }

      const kbResponse = await fetch('/api/knowledge-base/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: transcript }),
      });
      const kbPayload = await readJson<{ match: { answer: string } | null }>(kbResponse);
      await askGroq(nextMessages, kbPayload.match?.answer);
    },
    [agentSpeak, askGroq, messages, saveMessage]
  );

  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsBusy(true);
      setListeningStatus('Transcribing with Groq Whisper Large v3...');

      try {
        const formData = new FormData();
        const file = new File([audioBlob], 'amharic-speech.webm', {
          type: audioBlob.type || 'audio/webm',
        });
        formData.append('audio', file);

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });
        const payload = await readJson<{ text: string }>(response);
        await handleUserTranscript(payload.text);
      } catch (error) {
        setListeningStatus(
          error instanceof Error ? `STT error: ${error.message}` : 'STT error.'
        );
      } finally {
        setIsBusy(false);
      }
    },
    [handleUserTranscript]
  );

  const startRecording = async () => {
    if (isBusy || isRecording || isSpeaking) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        stopMediaStream();
        void transcribeAudio(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setListeningStatus('Recording Amharic audio...');
    } catch (error) {
      setListeningStatus(
        error instanceof Error ? `Microphone error: ${error.message}` : 'Microphone error.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setListeningStatus('Processing audio...');
  };

  const startCall = async () => {
    stateRef.current = 'ASK_NAME';
    callSessionIdRef.current = null;
    currentCustomerIdRef.current = null;
    currentCustomerNameRef.current = null;
    setMessages([]);
    setCallActive(true);
    setShowUserMessage(false);
    setUserMessage('');

    callStartTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (callStartTimeRef.current || Date.now())) / 1000);
      const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const seconds = String(elapsed % 60).padStart(2, '0');
      setCallTimer(`${minutes}:${seconds}`);
    }, 1000);

    try {
      const response = await fetch('/api/calls/start', { method: 'POST' });
      const payload = await readJson<{ callSessionId: string; prompt: string }>(response);

      callSessionIdRef.current = payload.callSessionId;
      await agentSpeak(payload.prompt, false);
    } catch (error) {
      await agentSpeak(
        error instanceof Error
          ? `I could not start the call: ${error.message}`
          : 'I could not start the call.'
      );
      endCall();
    }
  };

  const endCall = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const callSessionId = callSessionIdRef.current;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    stateRef.current = 'IDLE';
    callSessionIdRef.current = null;
    currentCustomerIdRef.current = null;
    currentCustomerNameRef.current = null;
    stopMediaStream();
    audioRef.current?.pause();
    cleanupAudioUrl();
    setCallActive(false);
    setCallTimer('00:00');
    setShowUserMessage(false);
    setIsRecording(false);
    setIsSpeaking(false);
    setIsBusy(false);
    setListeningStatus('');

    if (callSessionId) {
      void fetch('/api/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSessionId }),
      }).catch(console.error);
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopMediaStream();
      cleanupAudioUrl();
    };
  }, []);

  return (
    <div id="root">
      <div className="container">
        <div className="phone-header">
          <span className="bank-name">Bank Call Center</span>
          <span className="call-timer">{callTimer}</span>
        </div>

        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.speaker}`}>
              {msg.text}
            </div>
          ))}
        </div>

        <div className="input-area">
          {!callActive ? (
            <>
              <button className="start-btn" onClick={startCall}>
                Start Amharic Call
              </button>
              {kbStatus && <small>{kbStatus}</small>}
            </>
          ) : (
            <>
              <button
                className="start-btn"
                disabled={isBusy || isSpeaking}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? 'Stop Recording' : isSpeaking ? 'Agent Speaking...' : 'Record Speech'}
              </button>
              <button className="stop-btn" onClick={endCall}>
                End Call
              </button>
            </>
          )}
        </div>

        {showUserMessage && (
          <div className="transcript">
            <strong>You said:</strong> {userMessage}
          </div>
        )}

        {listeningStatus && (
          <div className="transcript">
            <small>{listeningStatus}</small>
          </div>
        )}

        <audio
          ref={audioRef}
          onEnded={() => {
            setIsSpeaking(false);
            setListeningStatus('Ready to listen...');
          }}
          onPause={() => setIsSpeaking(false)}
        />
      </div>
    </div>
  );
}
