// Mock user database
const USERS = {
  "aymen": {
    pin: "1234",
    balance: "5200 birr",
    transaction: "200 birr sent"
  }
};

// State Machine
const STATES = {
  IDLE: "IDLE",
  ASK_NAME: "ASK_NAME",
  ASK_PIN: "ASK_PIN",
  AUTHENTICATED: "AUTHENTICATED",
  MENU: "MENU"
};

// Global State
let state = STATES.IDLE;
let callStartTime = null;
let timerInterval = null;
let currentUser = null;
let knowledgeBase = "";
let conversationHistory = [];

// Speech Recognition Setup
const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = false;
recognition.lang = "en-US";

// Speech Synthesis Setup
const synth = window.speechSynthesis;

// DOM Elements
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
const kbUpload = document.getElementById("kb-upload");
const kbStatus = document.getElementById("kb-status");

// Event Listeners
startCallBtn.addEventListener("click", startCall);
endCallBtn.addEventListener("click", endCall);
speakBtn.addEventListener("click", startListening);
kbUpload.addEventListener("change", handleKBUpload);

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

// Call Management
function startCall() {
  state = STATES.ASK_NAME;
  currentUser = null;
  conversationHistory = [];
  
  idleScreen.classList.remove("active");
  callScreen.classList.add("active");
  
  callStartTime = Date.now();
  startTimer();
  
  agentSpeak("Hello, welcome to Ethiopian Bank. What is your name?");
}

function endCall() {
  clearInterval(timerInterval);
  state = STATES.IDLE;
  currentUser = null;
  conversationHistory = [];
  synth.cancel();
  
  callScreen.classList.remove("active");
  idleScreen.classList.add("active");
  
  userMessageGroup.style.display = "none";
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

// Speech Output
function agentSpeak(text) {
  agentStatus.textContent = "Speaking...";
  agentMessage.textContent = text;
  conversationHistory.push({ speaker: "agent", text });
  
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

// User Input Handling
function handleUserInput(transcript) {
  userMessage.textContent = transcript;
  userMessageGroup.style.display = "block";
  conversationHistory.push({ speaker: "user", text: transcript });
  
  // Delay before agent responds (simulate real system)
  setTimeout(() => {
    processUserInput(transcript.toLowerCase());
  }, 1000);
}

function processUserInput(input) {
  if (state === STATES.ASK_NAME) {
    handleNameInput(input);
  } else if (state === STATES.ASK_PIN) {
    handlePinInput(input);
  } else if (state === STATES.MENU) {
    handleMenuInput(input);
  }
}

// Authentication Flow
function handleNameInput(name) {
  // Simple matching
  if (name.includes("aymen")) {
    currentUser = "aymen";
    state = STATES.ASK_PIN;
    agentSpeak("Thank you. Please enter your PIN.");
  } else {
    agentSpeak("I'm sorry, I couldn't find that name. Let me connect you to a human agent. Please hold.");
  }
}

function handlePinInput(pin) {
  if (!currentUser) return;
  
  // Extract digits from the input
  const digits = pin.replace(/\D/g, "");
  
  if (digits === USERS[currentUser].pin) {
    state = STATES.MENU;
    agentSpeak(`Welcome back, ${currentUser}. How can I help you today? You can ask for your balance, recent transaction, or anything else.`);
  } else {
    agentSpeak("I'm sorry, that PIN is incorrect. Connecting you to a human agent.");
    state = STATES.MENU; // Fallback to menu to prevent infinite loop
  }
}

function handleMenuInput(input) {
  if (!currentUser) {
    agentSpeak("I'm sorry, there was an authentication issue. Connecting you to a human agent.");
    return;
  }

  // Intent matching
  if (input.includes("balance")) {
    const balance = USERS[currentUser].balance;
    agentSpeak(`Your current account balance is ${balance}.`);
  } else if (input.includes("transaction") || input.includes("recent")) {
    const transaction = USERS[currentUser].transaction;
    agentSpeak(`Your most recent transaction is: ${transaction}.`);
  } else {
    // Try knowledge base search
    const kbMatch = searchKnowledgeBase(input);
    if (kbMatch) {
      agentSpeak(kbMatch);
    } else {
      agentSpeak("I'm sorry, I didn't understand that. Let me connect you to a human agent who can help you better.");
    }
  }
}

// Knowledge Base
function handleKBUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    knowledgeBase = e.target.result;
    kbStatus.textContent = "✅ Knowledge base loaded successfully!";
  };
  reader.onerror = () => {
    kbStatus.textContent = "❌ Error loading file";
  };
  reader.readAsText(file);
}

function searchKnowledgeBase(query) {
  if (!knowledgeBase) return null;

  const lines = knowledgeBase.split("\n");
  const queryWords = query.split(" ");

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    const lineWords = line.toLowerCase().split(" ");
    const matches = queryWords.filter(word => lineWords.some(lw => lw.includes(word) && word.length > 2));

    if (matches.length >= Math.min(2, queryWords.length)) {
      return line.trim().substring(0, 150) + "...";
    }
  }

  return null;
}

console.log("Bank Call Center initialized. Click 'Start Call' to begin.");
