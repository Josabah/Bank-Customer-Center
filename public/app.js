const STATES = {
  IDLE: "IDLE",
  ASK_NAME: "ASK_NAME",
  ASK_PIN: "ASK_PIN",
  MENU: "MENU",
};

let state = STATES.IDLE;
let callStartTime = null;
let timerInterval = null;
let callSessionId = null;
let currentCustomerId = null;
let currentCustomerName = null;
let conversationHistory = [];

const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = false;
recognition.lang = "en-US";

const synth = window.speechSynthesis;

const idleScreen = document.getElementById("idle-screen");
const callScreen = document.getElementById("call-screen");
const startCallBtn = document.getElementById("start-call-btn");
const endCallBtn = document.getElementById("end-call-btn");
const speakBtn = document.getElementById("speak-btn");
const agentMessage = document.getElementById("agent-message");
const agentStatus = document.getElementById("agent-status");
const userMessage = document.getElementById("user-message");
const userMessageGroup = document.getElementById("user-message-group");
const listeningStatus = document.getElementById("listening-status");
const callTime = document.getElementById("call-time");
const kbStatus = document.getElementById("kb-status");

startCallBtn.addEventListener("click", startCall);
endCallBtn.addEventListener("click", endCall);
speakBtn.addEventListener("click", startListening);
kbStatus.textContent = "Knowledge base is managed in Supabase.";

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || "Request failed.");
  }

  return payload;
}

recognition.onstart = () => {
  listeningStatus.textContent = "🎙️ Listening...";
  speakBtn.disabled = true;
};

recognition.onresult = (event) => {
  let transcript = "";
  for (let i = event.resultIndex; i < event.results.length; i++) {
    transcript += event.results[i][0].transcript;
  }
  handleUserInput(transcript.trim());
};

recognition.onerror = (event) => {
  console.error("Speech recognition error", event.error);
  listeningStatus.textContent = "❌ Error: " + event.error;
  speakBtn.disabled = false;
};

recognition.onend = () => {
  listeningStatus.textContent = "";
  speakBtn.disabled = false;
};

async function startCall() {
  state = STATES.ASK_NAME;
  currentCustomerId = null;
  currentCustomerName = null;
  conversationHistory = [];

  idleScreen.classList.remove("active");
  callScreen.classList.add("active");

  callStartTime = Date.now();
  startTimer();

  try {
    const response = await apiRequest("/api/calls/start", { method: "POST" });
    callSessionId = response.callSessionId;
    agentSpeak(response.prompt, false);
  } catch (error) {
    agentSpeak(`I could not start the call: ${error.message}`);
    endCall();
  }
}

function endCall() {
  clearInterval(timerInterval);
  const sessionToEnd = callSessionId;
  state = STATES.IDLE;
  currentCustomerId = null;
  currentCustomerName = null;
  callSessionId = null;
  conversationHistory = [];
  synth.cancel();

  callScreen.classList.remove("active");
  idleScreen.classList.add("active");

  userMessageGroup.style.display = "none";

  if (sessionToEnd) {
    apiRequest("/api/calls/end", {
      method: "POST",
      body: JSON.stringify({ callSessionId: sessionToEnd }),
    }).catch(console.error);
  }
}

function startTimer() {
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    callTime.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

function startListening() {
  if (state === STATES.IDLE) return;
  recognition.start();
}

function agentSpeak(text, persist = true) {
  agentStatus.textContent = "Speaking...";
  agentMessage.textContent = text;
  conversationHistory.push({ speaker: "agent", text });

  if (persist) {
    saveMessage("agent", text);
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onend = () => {
    agentStatus.textContent = "";
    setTimeout(() => {
      listeningStatus.textContent = "👂 Ready to listen...";
    }, 500);
  };

  synth.cancel();
  synth.speak(utterance);
}

function saveMessage(speaker, message) {
  if (!callSessionId) return;

  apiRequest("/api/calls/message", {
    method: "POST",
    body: JSON.stringify({ callSessionId, speaker, message }),
  }).catch(console.error);
}

function handleUserInput(transcript) {
  userMessage.textContent = transcript;
  userMessageGroup.style.display = "block";
  conversationHistory.push({ speaker: "user", text: transcript });

  setTimeout(() => {
    processUserInput(transcript.toLowerCase()).catch((error) => {
      agentSpeak(`I ran into a backend issue: ${error.message}`);
    });
  }, 1000);
}

async function processUserInput(input) {
  if (state === STATES.ASK_NAME) {
    await handleNameInput(input);
  } else if (state === STATES.ASK_PIN) {
    await handlePinInput(input);
  } else if (state === STATES.MENU) {
    await handleMenuInput(input);
  }
}

async function handleNameInput(name) {
  try {
    const response = await apiRequest("/api/auth/identify", {
      method: "POST",
      body: JSON.stringify({ callSessionId, transcript: name }),
    });
    currentCustomerId = response.customerId;
    currentCustomerName = response.displayName;
    state = STATES.ASK_PIN;
    agentSpeak(response.prompt, false);
  } catch {
    state = STATES.MENU;
    agentSpeak("I'm sorry, I couldn't find that name. Let me connect you to a human agent. Please hold.");
  }
}

async function handlePinInput(pin) {
  try {
    const response = await apiRequest("/api/auth/verify-pin", {
      method: "POST",
      body: JSON.stringify({ callSessionId, customerId: currentCustomerId, pin }),
    });
    state = STATES.MENU;
    agentSpeak(
      response.prompt.replace("Welcome back.", `Welcome back, ${currentCustomerName || "customer"}.`),
      false
    );
  } catch {
    state = STATES.MENU;
    agentSpeak("I'm sorry, that PIN is incorrect. Connecting you to a human agent.");
  }
}

async function handleMenuInput(input) {
  if (!callSessionId || !currentCustomerId) {
    agentSpeak("I'm sorry, there was an authentication issue. Connecting you to a human agent.");
    return;
  }

  saveMessage("user", input);

  if (input.includes("balance")) {
    const summary = await apiRequest(`/api/accounts/summary?callSessionId=${callSessionId}`);
    agentSpeak(`Your current account balance is ${summary.balance}.`);
  } else if (input.includes("transaction") || input.includes("recent")) {
    const transaction = await apiRequest(`/api/transactions/recent?callSessionId=${callSessionId}`);
    agentSpeak(`Your most recent transaction is: ${transaction.description}.`);
  } else {
    const response = await apiRequest("/api/knowledge-base/search", {
      method: "POST",
      body: JSON.stringify({ query: input }),
    });

    if (response.match) {
      agentSpeak(response.match.answer);
    } else {
      agentSpeak("I'm sorry, I didn't understand that. Let me connect you to a human agent who can help you better.");
    }
  }
}

console.log("Bank Call Center initialized. Click 'Start Call' to begin.");
