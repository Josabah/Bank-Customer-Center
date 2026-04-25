'use client';

import { useEffect, useRef, useState } from 'react';

export default function Home() {
  const [callActive, setCallActive] = useState(false);
  const [callTimer, setCallTimer] = useState('00:00');
  const [messages, setMessages] = useState<Array<{ speaker: string; text: string }>>([]);
  const [listeningStatus, setListeningStatus] = useState('');
  const [kbStatus, setKbStatus] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [showUserMessage, setShowUserMessage] = useState(false);

  const callStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserRef = useRef<string | null>(null);
  const knowledgeBaseRef = useRef('');
  const stateRef = useRef('IDLE');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const synthRef = useRef(window.speechSynthesis);

  const SpeechRecognition = typeof window !== 'undefined' ? (window.webkitSpeechRecognition || (window as any).SpeechRecognition) : null;
  const recognitionRef = useRef<any>(null);

  const USERS = {
    aymen: {
      pin: '1234',
      balance: '5200 birr',
      transaction: '200 birr sent',
    },
  };

  const STATES = {
    IDLE: 'IDLE',
    ASK_NAME: 'ASK_NAME',
    ASK_PIN: 'ASK_PIN',
    AUTHENTICATED: 'AUTHENTICATED',
    MENU: 'MENU',
  };

  useEffect(() => {
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setListeningStatus('🎙️ Listening...');
      };

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        handleUserInput(transcript.trim());
      };

      recognitionRef.current.onerror = (event: any) => {
        setListeningStatus('❌ Error: ' + event.error);
      };

      recognitionRef.current.onend = () => {
        setListeningStatus('');
      };
    }
  }, []);

  const addMessage = (speaker: string, text: string) => {
    setMessages((prev) => [...prev, { speaker, text }]);
  };

  const agentSpeak = (text: string) => {
    addMessage('agent', text);
    setListeningStatus('Speaking...');

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
      setListeningStatus('');
      setTimeout(() => {
        setListeningStatus('👂 Ready to listen...');
      }, 500);
    };

    synthRef.current.cancel();
    synthRef.current.speak(utterance);
  };

  const startCall = () => {
    stateRef.current = STATES.ASK_NAME;
    currentUserRef.current = null;
    setMessages([]);
    setCallActive(true);
    setShowUserMessage(false);

    callStartTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (callStartTimeRef.current || Date.now())) / 1000);
      const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const seconds = String(elapsed % 60).padStart(2, '0');
      setCallTimer(`${minutes}:${seconds}`);
    }, 1000);

    agentSpeak('Hello, welcome to Ethiopian Bank. What is your name?');
  };

  const endCall = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    stateRef.current = STATES.IDLE;
    currentUserRef.current = null;
    synthRef.current.cancel();
    setCallActive(false);
    setCallTimer('00:00');
    setShowUserMessage(false);
    setListeningStatus('');
  };

  const startListening = () => {
    if (recognitionRef.current && stateRef.current !== STATES.IDLE) {
      recognitionRef.current.start();
    }
  };

  const handleUserInput = (transcript: string) => {
    setUserMessage(transcript);
    setShowUserMessage(true);
    addMessage('user', transcript);

    setTimeout(() => {
      processUserInput(transcript.toLowerCase());
    }, 1000);
  };

  const processUserInput = (input: string) => {
    if (stateRef.current === STATES.ASK_NAME) {
      handleNameInput(input);
    } else if (stateRef.current === STATES.ASK_PIN) {
      handlePinInput(input);
    } else if (stateRef.current === STATES.MENU) {
      handleMenuInput(input);
    }
  };

  const handleNameInput = (name: string) => {
    if (name.includes('aymen')) {
      currentUserRef.current = 'aymen';
      stateRef.current = STATES.ASK_PIN;
      agentSpeak('Thank you. Please enter your PIN.');
    } else {
      agentSpeak('I\'m sorry, I couldn\'t find that name. Let me connect you to a human agent. Please hold.');
    }
  };

  const handlePinInput = (pin: string) => {
    if (!currentUserRef.current) return;

    const digits = pin.replace(/\D/g, '');

    if (digits === USERS[currentUserRef.current as keyof typeof USERS].pin) {
      stateRef.current = STATES.MENU;
      agentSpeak(
        `Welcome back, ${currentUserRef.current}. How can I help you today? You can ask for your balance, recent transaction, or anything else.`
      );
    } else {
      agentSpeak('I\'m sorry, that PIN is incorrect. Connecting you to a human agent.');
      stateRef.current = STATES.MENU;
    }
  };

  const handleMenuInput = (input: string) => {
    if (!currentUserRef.current) {
      agentSpeak('I\'m sorry, there was an authentication issue. Connecting you to a human agent.');
      return;
    }

    if (input.includes('balance')) {
      const balance = USERS[currentUserRef.current as keyof typeof USERS].balance;
      agentSpeak(`Your current account balance is ${balance}.`);
    } else if (input.includes('transaction') || input.includes('recent')) {
      const transaction = USERS[currentUserRef.current as keyof typeof USERS].transaction;
      agentSpeak(`Your most recent transaction is: ${transaction}.`);
    } else {
      const kbMatch = searchKnowledgeBase(input);
      if (kbMatch) {
        agentSpeak(kbMatch);
      } else {
        agentSpeak('I\'m sorry, I didn\'t understand that. Let me connect you to a human agent who can help you better.');
      }
    }
  };

  const searchKnowledgeBase = (query: string) => {
    if (!knowledgeBaseRef.current) return null;

    const lines = knowledgeBaseRef.current.split('\n');
    const queryWords = query.split(' ');

    for (const line of lines) {
      if (line.trim().length === 0) continue;

      const lineWords = line.toLowerCase().split(' ');
      const matches = queryWords.filter(
        (word) => lineWords.some((lw) => lw.includes(word) && word.length > 2)
      );

      if (matches.length >= Math.min(2, queryWords.length)) {
        return line.trim().substring(0, 150) + '...';
      }
    }

    return null;
  };

  const handleKBUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      knowledgeBaseRef.current = e.target?.result as string;
      setKbStatus('✅ Knowledge base loaded successfully!');
    };
    reader.onerror = () => {
      setKbStatus('❌ Error loading file');
    };
    reader.readAsText(file);
  };

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
                🎤 Start Call
              </button>
              <button
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                📄 Upload KB
              </button>
              {kbStatus && <small>{kbStatus}</small>}
            </>
          ) : (
            <>
              <button className="start-btn" onClick={startListening}>
                🎤 Speak
              </button>
              <button className="stop-btn" onClick={endCall}>
                ⏹️ End Call
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

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          style={{ display: 'none' }}
          onChange={handleKBUpload}
        />
      </div>
    </div>
  );
}
