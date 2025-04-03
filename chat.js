/**
 * Game Chat System
 * Handles text and voice chat functionality between players
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendChatBtn = document.getElementById('sendChatBtn');
  const quickMsgBtns = document.querySelectorAll('.quick-msg-btn');
  const toggleChatBtn = document.getElementById('toggleChatBtn');
  const voiceChatBtn = document.getElementById('voiceChatBtn');
  const voiceChat = document.getElementById('voiceChat');
  const toggleMicBtn = document.getElementById('toggleMicBtn');
  const voiceStatus = document.getElementById('voiceStatus');
  const voiceIndicator = document.getElementById('voiceIndicator');
  
  // Chat state
  let chatState = {
    minimized: false,
    voiceChatActive: false,
    microphoneMuted: false,
    stream: null,
    peerConnection: null,
    roomId: null,
    playerName: null,
    playerSymbol: null
  };

  // Initialize chat system
  const initChat = () => {
    // Listen for chat messages from Firebase
    listenForChatMessages();
    
    // Set up event listeners
    setupEventListeners();
    
    // Add a system message
    addSystemMessage('Chat system ready');
  };

  // Setup event listeners
  const setupEventListeners = () => {
    // Send message when clicking send button
    sendChatBtn.addEventListener('click', sendMessage);
    
    // Send message when pressing Enter in input field
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    
    // Quick message buttons
    quickMsgBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const message = btn.dataset.msg;
        chatInput.value = message;
        sendMessage();
      });
    });
    
    // Toggle chat visibility
    toggleChatBtn.addEventListener('click', toggleChat);
    
    // Voice chat button
    voiceChatBtn.addEventListener('click', toggleVoiceChat);
    
    // Microphone toggle
    toggleMicBtn.addEventListener('click', toggleMicrophone);
  };

  // Listen for chat messages from Firebase
  const listenForChatMessages = () => {
    const gameRef = window.gameRef;
    const roomCode = window.gameState?.roomCode;
    
    if (!gameRef || !roomCode) {
      console.log('Game reference or room code not available yet');
      // Try again in a second
      setTimeout(listenForChatMessages, 1000);
      return;
    }
    
    chatState.roomId = roomCode;
    chatState.playerName = window.gameState.playerName || 'Player';
    chatState.playerSymbol = window.gameState.playerSymbol || '?';
    
    // Create a chat reference
    const chatRef = gameRef.child('chat');
    
    // Listen for new messages
    chatRef.on('child_added', (snapshot) => {
      const message = snapshot.val();
      displayMessage(message);
    });
    
    // Listen for game state changes to update player info
    gameRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data && window.gameState) {
        chatState.playerName = window.gameState.playerName || 'Player';
        chatState.playerSymbol = window.gameState.playerSymbol || '?';
      }
    });
  };

  // Send a chat message
  const sendMessage = () => {
    const message = chatInput.value.trim();
    if (!message) return;
    
    if (!window.gameRef || !chatState.roomId) {
      addSystemMessage('Cannot send message: not connected to a game');
      return;
    }
    
    const chatRef = window.gameRef.child('chat');
    const newMessage = {
      sender: chatState.playerName,
      symbol: chatState.playerSymbol,
      text: message,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    chatRef.push(newMessage)
      .then(() => {
        chatInput.value = '';
        chatInput.focus();
      })
      .catch((error) => {
        console.error('Error sending message:', error);
        addSystemMessage('Failed to send message');
      });
  };

  // Display a message in the chat window
  const displayMessage = (message) => {
    const isOutgoing = message.symbol === chatState.playerSymbol;
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isOutgoing ? 'outgoing' : 'incoming');
    
    const sender = document.createElement('div');
    sender.classList.add('sender');
    sender.textContent = `${message.sender} (${message.symbol})`;
    
    const text = document.createElement('div');
    text.classList.add('text');
    text.textContent = message.text;
    
    const timestamp = document.createElement('div');
    timestamp.classList.add('timestamp');
    timestamp.textContent = formatTimestamp(message.timestamp);
    
    messageElement.appendChild(sender);
    messageElement.appendChild(text);
    messageElement.appendChild(timestamp);
    
    chatMessages.appendChild(messageElement);
    scrollToBottom();
  };

  // Add a system message
  const addSystemMessage = (text) => {
    const systemMsg = document.createElement('div');
    systemMsg.classList.add('system-message');
    systemMsg.textContent = text;
    
    chatMessages.appendChild(systemMsg);
    scrollToBottom();
  };

  // Format timestamp to readable time
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Scroll chat to the bottom
  const scrollToBottom = () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  // Toggle chat visibility
  const toggleChat = () => {
    const chatContainer = document.querySelector('.chat-container');
    chatState.minimized = !chatState.minimized;
    
    if (chatState.minimized) {
      chatContainer.style.height = '50px';
      chatContainer.style.overflow = 'hidden';
      toggleChatBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
    } else {
      chatContainer.style.height = '400px';
      chatContainer.style.overflow = 'visible';
      toggleChatBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    }
  };

  // Toggle voice chat
  const toggleVoiceChat = () => {
    chatState.voiceChatActive = !chatState.voiceChatActive;
    
    if (chatState.voiceChatActive) {
      voiceChat.classList.remove('hidden');
      startVoiceChat();
    } else {
      voiceChat.classList.add('hidden');
      stopVoiceChat();
    }
  };

  // Start voice chat
  const startVoiceChat = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chatState.stream = stream;
      
      // Update UI
      voiceStatus.textContent = 'Voice chat connected';
      toggleMicBtn.classList.add('active');
      toggleMicBtn.classList.remove('muted');
      
      // TODO: Set up WebRTC for peer-to-peer connection
      // This is a simplified version - a full implementation would need WebRTC
      addSystemMessage('Voice chat is ready! (Note: Full implementation requires WebRTC)');
      
      // Set up audio processing to detect when speaking
      setupVoiceDetection(stream);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      voiceStatus.textContent = 'Microphone access denied';
      addSystemMessage('Could not access microphone');
      chatState.voiceChatActive = false;
    }
  };

  // Stop voice chat
  const stopVoiceChat = () => {
    if (chatState.stream) {
      chatState.stream.getTracks().forEach(track => track.stop());
      chatState.stream = null;
    }
    
    // Update UI
    voiceStatus.textContent = 'Voice chat ended';
    voiceIndicator.classList.remove('active');
    
    // If we had a peer connection, close it
    if (chatState.peerConnection) {
      chatState.peerConnection.close();
      chatState.peerConnection = null;
    }
    
    addSystemMessage('Voice chat ended');
  };

  // Toggle microphone mute state
  const toggleMicrophone = () => {
    if (!chatState.stream) return;
    
    chatState.microphoneMuted = !chatState.microphoneMuted;
    
    // Mute/unmute all audio tracks
    chatState.stream.getAudioTracks().forEach(track => {
      track.enabled = !chatState.microphoneMuted;
    });
    
    // Update UI
    if (chatState.microphoneMuted) {
      toggleMicBtn.classList.add('muted');
      toggleMicBtn.classList.remove('active');
      voiceStatus.textContent = 'Microphone muted';
    } else {
      toggleMicBtn.classList.remove('muted');
      toggleMicBtn.classList.add('active');
      voiceStatus.textContent = 'Voice chat active';
    }
  };

  // Setup voice activity detection
  const setupVoiceDetection = (stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);
      
      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;
      
      microphone.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
      
      scriptProcessor.onaudioprocess = function() {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        const arraySum = array.reduce((a, value) => a + value, 0);
        const average = arraySum / array.length;
        
        // If sound is detected (adjust threshold as needed)
        if (average > 15 && !chatState.microphoneMuted) {
          voiceIndicator.classList.add('active');
        } else {
          voiceIndicator.classList.remove('active');
        }
      };
    } catch (e) {
      console.error('Error setting up voice detection:', e);
    }
  };

  // Initialize the chat when the game state is ready
  const waitForGameState = () => {
    if (window.gameState) {
      initChat();
    } else {
      setTimeout(waitForGameState, 500);
    }
  };

  // Start waiting for game state
  waitForGameState();
}); 