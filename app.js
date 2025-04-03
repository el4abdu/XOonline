// XO Game with Firebase Realtime Implementation
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const gameSetup = document.getElementById('gameSetup');
  const gameBoard = document.getElementById('gameBoard');
  const createGameBtn = document.getElementById('createGameBtn');
  const joinGameBtn = document.getElementById('joinGameBtn');
  const joinGameInput = document.getElementById('joinGameInput');
  const statusMessage = document.getElementById('statusMessage');
  const playerSymbol = document.getElementById('playerSymbol');
  const roomCodeDisplay = document.getElementById('roomCode');
  const boardCells = document.querySelectorAll('.board-cell');
  const copyRoomBtn = document.getElementById('copyRoomBtn');
  const exitRoomBtn = document.getElementById('exitRoomBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const notification = document.getElementById('notification');
  const notificationMessage = document.getElementById('notificationMessage');
  const darkModeToggle = document.getElementById('darkModeToggle');

  // Game State
  let gameState = {
    roomCode: null,
    playerSymbol: null,
    isPlayerTurn: false,
    gameActive: false,
    board: Array(9).fill(''),
    currentTurn: 'X',
    gameEnded: false,
    winner: null,
    playerName: 'Player ' + Math.floor(Math.random() * 1000),
    isCreator: false,
    readyState: {
      creator: false,
      joiner: false
    },
    isQuickGame: false,
    isAIGame: false,
    // Add score tracking
    playerXScore: 0,
    playerOScore: 0
  };

  // References
  let gameRef = null;
  let movesRef = null;
  let chatRef = null;
  let quickMatchRef = null;
  let waitingForMatch = false;
  let matchmakingTimeout = null;
  let unreadMessages = 0;

  // Generate a random room code
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Initialize UI
  const initUI = () => {
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
      darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Initially hide the game board and show setup
    gameBoard.classList.remove('active');
    gameSetup.classList.add('active');
    updateStatusMessage('Create a new game or join an existing one');
    
    // Initially hide action buttons
    copyRoomBtn.style.display = 'none';
    exitRoomBtn.style.display = 'none';
    newGameBtn.style.display = 'none';

    // Initialize tactical mode badge as hidden
    if (window.tacticalMode) {
      document.getElementById('tacticalBadge').style.display = 'none';
      document.getElementById('actionPanel').classList.remove('active');
      document.getElementById('blitzTimer').style.display = 'none';
      document.getElementById('gameStats').style.display = 'none';
      document.getElementById('replayContainer').style.display = 'none';
    }

    // Help Modal Functions
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelp = document.getElementById('closeHelp');
    
    // Open help modal
    helpBtn.addEventListener('click', () => {
      helpModal.classList.add('active');
    });
    
    // Close help modal
    closeHelp.addEventListener('click', () => {
      helpModal.classList.remove('active');
    });
    
    // Close modal when clicking outside
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.classList.remove('active');
      }
    });
  };

  // Update status message
  const updateStatusMessage = (message) => {
    statusMessage.textContent = message;
  };

  // Show notification
  const showNotification = (message, duration = 3000) => {
    notificationMessage.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
      notification.classList.remove('show');
    }, duration);
  };

  // Render the board based on current game state
  const renderBoard = () => {
    boardCells.forEach((cell, index) => {
      // Clear existing classes
      cell.classList.remove('x-move', 'o-move', 'winner');
      
      // Get the flip-back element inside the cell
      const flipBack = cell.querySelector('.flip-back');
      if (flipBack) {
        // Set the content of the flip-back based on the move
        if (gameState.board[index] === 'X') {
          flipBack.textContent = 'X';
          cell.classList.add('x-move');
        } else if (gameState.board[index] === 'O') {
          flipBack.textContent = 'O';
          cell.classList.add('o-move');
        } else {
          flipBack.textContent = '';
        }
      }
      
      // Highlight winning cells
      if (gameState.winner && gameState.winner.line && gameState.winner.line.includes(index)) {
        cell.classList.add('winner');
      }
    });
    
    // Update score display
    updateScoreDisplay();
  };
  
  // Update score display
  const updateScoreDisplay = () => {
    const playerXScoreElement = document.getElementById('playerXScore');
    const playerOScoreElement = document.getElementById('playerOScore');
    
    if (playerXScoreElement) {
      playerXScoreElement.textContent = gameState.playerXScore;
    }
    
    if (playerOScoreElement) {
      playerOScoreElement.textContent = gameState.playerOScore;
    }
    
    // Highlight active player's score container
    const playerXContainer = document.querySelector('.player-score-container.player-x');
    const playerOContainer = document.querySelector('.player-score-container.player-o');
    
    if (playerXContainer && playerOContainer) {
      if (gameState.currentTurn === 'X') {
        playerXContainer.classList.add('turn');
        playerOContainer.classList.remove('turn');
      } else if (gameState.currentTurn === 'O') {
        playerOContainer.classList.add('turn');
        playerXContainer.classList.remove('turn');
      } else {
        // No turn active (e.g., game over or not started)
        playerXContainer.classList.remove('turn');
        playerOContainer.classList.remove('turn');
      }
    }
  };

  // Check for a win
  const checkWin = (board) => {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        // Update score for the winner
        if (board[a] === 'X') {
          gameState.playerXScore += 1;
        } else if (board[a] === 'O') {
          gameState.playerOScore += 1;
        }
        
        return {
          winner: board[a],
          line: pattern
        };
      }
    }

    // Check for a draw
    if (!board.includes('')) {
      return { winner: 'Draw' };
    }

    return null;
  };

  // Create a new game
  const createGame = () => {
    // Show notification
    showNotification('Creating new game...');
    
    // Get the game mode from tactical mode if available
    const isTacticalMode = window.tacticalMode && window.tacticalMode.state.gameMode === 'tactical';
    
    const roomCode = generateRoomCode();
    
    // Creator will always wait for player 2 to join first
    // Symbols will be assigned randomly after player 2 joins
    gameState.roomCode = roomCode;
    gameState.playerSymbol = 'waiting'; // Temporary - will be assigned when player 2 joins
    gameState.isPlayerTurn = false;
    gameState.gameActive = true;
    gameState.board = Array(9).fill('');
    gameState.currentTurn = 'X'; // Default, will be randomized after both players join
    gameState.gameEnded = false;
    gameState.winner = null;
    gameState.isCreator = true; // Track if this player created the game

    // Update Firebase
    gameRef = database.ref(`games/${roomCode}`);
    movesRef = gameRef.child('moves');
    
    database.ref('.info/connected').once('value')
      .then(snap => {
        if (snap.val() === true) {
          // Create initial game state
          return gameRef.set({
            status: 'waiting',
            playerSymbol: 'waiting',
            board: Array(9).fill(''),
            currentTurn: 'X',
            gameEnded: false,
            gameStartedAt: null,
            players: {
              creator: gameState.playerName,
              creatorConnected: true
            },
            readyState: {
              creator: false,
              joiner: false,
              creatorCanStart: false
            },
            chat: {
              welcome: {
                sender: 'System',
                message: 'Game room created! Share the room code with a friend to start playing.',
                timestamp: firebase.database.ServerValue.TIMESTAMP
              }
            }
          });
        } else {
          throw new Error('No Firebase connection');
        }
      })
      .then(() => {
        console.log('Game created successfully with code:', roomCode);
        
        // Listen for changes
        setupGameListeners();
        
        // Initialize chat
        setupChat();

        // Update UI
        gameSetup.classList.remove('active');
        gameBoard.classList.add('active');
        roomCodeDisplay.textContent = roomCode;
        playerSymbol.textContent = 'Waiting...';
        
        // Update status
        updateStatusMessage("Waiting for Player 2 to join...");
        
        // Show buttons
        copyRoomBtn.style.display = 'flex';
        exitRoomBtn.style.display = 'flex';
        newGameBtn.style.display = 'none';
        
        // Show and collapse chat by default
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
          chatContainer.classList.add('collapsed');
        }

        // Show ready button (will be enabled when player 2 joins)
        const readyBtn = document.createElement('button');
        readyBtn.id = 'readyBtn';
        readyBtn.className = 'action-btn';
        readyBtn.disabled = true;
        
        // Create button elements
        const buttonTop = document.createElement('div');
        buttonTop.className = 'button-top';
        buttonTop.innerHTML = 'Start Game';
        
        const buttonBottom = document.createElement('div');
        buttonBottom.className = 'button-bottom';
        
        const buttonBase = document.createElement('div');
        buttonBase.className = 'button-base';
        
        // Append elements to button
        readyBtn.appendChild(buttonTop);
        readyBtn.appendChild(buttonBottom);
        readyBtn.appendChild(buttonBase);
        
        readyBtn.addEventListener('click', markPlayerReady);
        
        // Find the correct container - handle multiple possibilities
        const actionButtonsContainer = document.querySelector('.action-buttons') || 
                                       document.querySelector('.game-actions');
        
        if (actionButtonsContainer) {
          actionButtonsContainer.appendChild(readyBtn);
        } else {
          // Fallback - append to gameBoard
          document.getElementById('gameBoard').appendChild(readyBtn);
        }
        
        // Initialize tactical mode if needed
        if (isTacticalMode) {
          window.tacticalMode.startTacticalGame();
        }
        
        showNotification(`Game created! Room code: ${roomCode}`);
      })
      .catch((error) => {
        console.error('Error creating game:', error);
        showNotification('Error creating game: ' + error.message);
        
        // Try to diagnose common issues
        checkFirebaseConnection();
      });
  };

  // Check Firebase connection issues
  const checkFirebaseConnection = () => {
    // Test if we can connect to Firebase
    database.ref('.info/connected').on('value', (snapshot) => {
      const connected = snapshot.val();
      console.log('Firebase connection status:', connected ? 'Connected' : 'Disconnected');
      
      if (!connected) {
        showNotification('Firebase connection issue. Check your internet connection.');
      }
    });
    
    // Check database rules
    database.ref('test_permission').set(Date.now())
      .then(() => {
        console.log('Database write permissions OK');
        database.ref('test_permission').remove();
      })
      .catch(error => {
        console.error('Database permission error:', error);
        showNotification('Database permission issue: ' + error.message);
      });
  };

  // Mark player as ready
  const markPlayerReady = () => {
    if (!gameRef) return;
    
    const playerType = gameState.isCreator ? 'creator' : 'joiner';
    
    // Update ready state in Firebase using safer approach
    const readyUpdate = {};
    if (playerType === 'creator') {
      readyUpdate['readyState'] = { ...gameState.readyState, creator: true };
    } else {
      readyUpdate['readyState'] = { ...gameState.readyState, joiner: true };
    }
    
    gameRef.update(readyUpdate)
      .then(() => {
        showNotification('You are ready!');
        
        // Disable ready button
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
          readyBtn.disabled = true;
          // Update button text
          const buttonTop = readyBtn.querySelector('.button-top');
          if (buttonTop) {
            buttonTop.textContent = 'Ready!';
          }
        }
        
        // If this is the creator and both players are ready, start the game
        if (gameState.isCreator) {
          gameRef.child('readyState').once('value', (snapshot) => {
            const readyState = snapshot.val() || {};
            
            if (readyState.creator && readyState.joiner) {
              // Both players are ready, randomize symbols and start the game
              startGameWithRandomSymbols();
            }
          });
        }
      })
      .catch(error => {
        console.error('Error updating ready state:', error);
        showNotification('Error: ' + error.message);
      });
  };
  
  // Start game with random symbols
  const startGameWithRandomSymbols = () => {
    if (!gameRef || !gameState.isCreator) return;
    
    // Show countdown animation
    showCountdown(() => {
      // Add transition effect to board
      const boardContainer = document.querySelector('.board-container');
      boardContainer.classList.add('game-starting');
      
      // Remove the class after animation completes
      setTimeout(() => {
        boardContainer.classList.remove('game-starting');
      }, 500);
      
      // Randomize symbols and first turn
      const creatorGetsX = Math.random() < 0.5;
      const firstTurn = Math.random() < 0.5 ? 'X' : 'O';
      
      gameRef.once('value', (snapshot) => {
        const gameData = snapshot.val() || {};
        const players = gameData.players || {};
        
        // Create new players object with randomized symbols
        const newPlayers = {};
        if (creatorGetsX) {
          newPlayers.X = players.creator;
          newPlayers.O = players.joiner;
        } else {
          newPlayers.X = players.joiner;
          newPlayers.O = players.creator;
        }
        
        // Update game with new player assignments and start
        gameRef.update({
          players: newPlayers,
          currentTurn: firstTurn,
          status: 'active',
          gameStartedAt: firebase.database.ServerValue.TIMESTAMP,
          playerXScore: 0, // Reset scores for new game
          playerOScore: 0
        })
        .then(() => {
          // Update local game state
          gameState.playerSymbol = creatorGetsX ? 'X' : 'O';
          gameState.isPlayerTurn = firstTurn === gameState.playerSymbol;
          gameState.currentTurn = firstTurn;
          gameState.playerXScore = 0;
          gameState.playerOScore = 0;
          
          // Update UI
          playerSymbol.textContent = gameState.playerSymbol;
          
          // Remove ready button
          const readyBtn = document.getElementById('readyBtn');
          if (readyBtn) {
            readyBtn.parentNode.removeChild(readyBtn);
          }
          
          if (gameState.isPlayerTurn) {
            updateStatusMessage("Your turn");
          } else {
            updateStatusMessage(`${gameState.currentTurn}'s turn`);
          }
          
          // Update score display
          updateScoreDisplay();
          
          showNotification('Game started!');
        })
        .catch(error => {
          console.error('Error starting game:', error);
          showNotification('Error: ' + error.message);
        });
      });
    });
  };
  
  // Show countdown 3-2-1 animation
  const showCountdown = (callback) => {
    const countdownOverlay = document.createElement('div');
    countdownOverlay.className = 'countdown-overlay';
    document.body.appendChild(countdownOverlay);
    
    let count = 3;
    
    const updateCount = () => {
      countdownOverlay.textContent = count;
      
      if (count === 0) {
        countdownOverlay.textContent = 'GO!';
        setTimeout(() => {
          document.body.removeChild(countdownOverlay);
          if (callback) callback();
        }, 500);
        return;
      }
      
      count--;
      setTimeout(updateCount, 1000);
    };
    
    updateCount();
  };

  // Join an existing game
  const joinGame = (roomCode) => {
    if (!roomCode) {
      showNotification('Please enter a room code');
      return;
    }
    
    // Show notification
    showNotification('Joining game...');
    
    // Check if the game exists
    const checkGameRef = database.ref(`games/${roomCode}`);
    checkGameRef.once('value')
      .then((snapshot) => {
        const gameData = snapshot.val();
        
        if (!gameData) {
          showNotification('Game not found');
          throw new Error('Game not found');
        }
        
        if (gameData.status === 'full') {
          showNotification('Game room is full');
          throw new Error('Game room is full');
        }
        
        // We can join this game
        gameState.roomCode = roomCode;
        gameState.playerSymbol = 'waiting'; // Will be assigned when game starts
        gameState.isPlayerTurn = false;
        gameState.gameActive = true;
        gameState.board = gameData.board || Array(9).fill('');
        gameState.currentTurn = gameData.currentTurn || 'X';
        gameState.gameEnded = gameData.gameEnded || false;
        gameState.winner = gameData.winner || null;
        gameState.isCreator = false; // This player is joining, not creating
        
        // Set up Firebase references
        gameRef = checkGameRef;
        movesRef = gameRef.child('moves');
        
        // Update the game to show player 2 has joined
        return gameRef.once('value')
          .then((snapshot) => {
            const fullGameData = snapshot.val();
            const updates = {};
            
            // Add joiner to players list
            updates[`players/joiner`] = gameState.playerName;
            updates[`players/joinerConnected`] = true;
            
            // Update ready state to enable the creator's ready button
            updates[`readyState/creatorCanStart`] = true;
            
            // Add a system message to chat
            const chatId = Date.now().toString();
            updates[`chat/${chatId}`] = {
              sender: 'System',
              message: `${gameState.playerName} has joined the game!`,
              timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            
            return gameRef.update(updates);
          })
          .then(() => {
            console.log('Successfully joined game');
            
            // Listen for changes
            setupGameListeners();
            
            // Initialize chat
            setupChat();
            
            // Update UI
            gameSetup.classList.remove('active');
            gameBoard.classList.add('active');
            roomCodeDisplay.textContent = roomCode;
            playerSymbol.textContent = 'Waiting...';
            
            updateStatusMessage("Waiting for game to start...");
            
            // Show action buttons
            copyRoomBtn.style.display = 'flex';
            exitRoomBtn.style.display = 'flex';
            newGameBtn.style.display = 'none';
            
            // Show and collapse chat by default
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
              chatContainer.classList.add('collapsed');
            }
            
            // Show ready button for player 2
            const readyBtn = document.createElement('button');
            readyBtn.id = 'readyBtn';
            readyBtn.className = 'action-btn';
            
            // Create button elements
            const buttonTop = document.createElement('div');
            buttonTop.className = 'button-top';
            buttonTop.innerHTML = 'Ready!';
            
            const buttonBottom = document.createElement('div');
            buttonBottom.className = 'button-bottom';
            
            const buttonBase = document.createElement('div');
            buttonBase.className = 'button-base';
            
            // Append elements to button
            readyBtn.appendChild(buttonTop);
            readyBtn.appendChild(buttonBottom);
            readyBtn.appendChild(buttonBase);
            
            readyBtn.addEventListener('click', markPlayerReady);
            
            // Find the correct container - handle multiple possibilities
            const actionButtonsContainer = document.querySelector('.action-buttons') || 
                                           document.querySelector('.game-actions');
            
            if (actionButtonsContainer) {
              actionButtonsContainer.appendChild(readyBtn);
            } else {
              // Fallback - append to gameBoard
              document.getElementById('gameBoard').appendChild(readyBtn);
            }
            
            // If the game is already in progress, hide the ready button
            if (gameData.status === 'active') {
              readyBtn.style.display = 'none';
            }
            
            showNotification('Joined game successfully!');
          });
      })
      .catch((error) => {
        console.error('Error joining game:', error);
        showNotification('Error joining game: ' + error.message);
      });
  };

  // Setup game listeners
  const setupGameListeners = () => {
    if (!gameRef) return;
    
    // Listen for game state changes
    gameRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      
      gameState.board = data.board || gameState.board;
      gameState.currentTurn = data.currentTurn || gameState.currentTurn;
      gameState.gameEnded = data.gameEnded || false;
      gameState.winner = data.winner || null;
      
      // Update scores
      if (data.playerXScore !== undefined) {
        gameState.playerXScore = data.playerXScore;
      }
      
      if (data.playerOScore !== undefined) {
        gameState.playerOScore = data.playerOScore;
      }
      
      // Update player symbol if it changed (after game started)
      if (data.players && (data.players.X || data.players.O)) {
        // If we now have symbols assigned instead of creator/joiner
        if (gameState.playerSymbol === 'waiting') {
          if (gameState.isCreator) {
            if (data.players.X === gameState.playerName) {
              gameState.playerSymbol = 'X';
              playerSymbol.textContent = 'X';
            } else if (data.players.O === gameState.playerName) {
              gameState.playerSymbol = 'O';
              playerSymbol.textContent = 'O';
            }
          } else { // is joiner
            if (data.players.X === gameState.playerName) {
              gameState.playerSymbol = 'X';
              playerSymbol.textContent = 'X';
            } else if (data.players.O === gameState.playerName) {
              gameState.playerSymbol = 'O';
              playerSymbol.textContent = 'O';
            }
          }
        }
      }
      
      // Update turn status once we know our symbol
      if (gameState.playerSymbol !== 'waiting') {
        gameState.isPlayerTurn = gameState.currentTurn === gameState.playerSymbol;
      }
      
      // Update UI based on current game state
      renderBoard();
      
      // Check for ready state changes
      if (data.readyState) {
        const readyBtn = document.getElementById('readyBtn');
        
        // Enable the creator's ready button when joiner joins
        if (gameState.isCreator && data.readyState.creatorCanStart && readyBtn && readyBtn.disabled) {
          readyBtn.disabled = false;
          const buttonTop = readyBtn.querySelector('.button-top');
          if (buttonTop) {
            buttonTop.textContent = 'Start Game';
          }
          showNotification('Player 2 has joined! Press Start when ready.');
        }
        
        // Show ready status of the other player
        if (gameState.isCreator && data.readyState.joiner) {
          showNotification('Player 2 is ready!');
        } else if (!gameState.isCreator && data.readyState.creator) {
          showNotification('Player 1 is ready!');
        }
      }
      
      // Update game status message based on game state
      if (gameState.gameEnded) {
        if (gameState.winner && gameState.winner.winner === 'Draw') {
          updateStatusMessage("Game ended in a draw!");
        } else if (gameState.winner) {
          if (gameState.winner.winner === gameState.playerSymbol) {
            updateStatusMessage("You won! 🎉");
          } else {
            updateStatusMessage(`Player ${gameState.winner.winner} won!`);
          }
        }
        newGameBtn.style.display = 'flex';
      } else {
        if (data.status === 'waiting') {
          if (gameState.isCreator) {
            updateStatusMessage("Waiting for Player 2 to join...");
          } else {
            updateStatusMessage("Waiting for game to start...");
          }
        } else if (data.status === 'active') {
          if (gameState.playerSymbol !== 'waiting') {
            if (gameState.isPlayerTurn) {
              updateStatusMessage("Your turn");
            } else {
              updateStatusMessage(`${gameState.currentTurn}'s turn`);
            }
          }
        }
      }
    });
    
    // Listen for player disconnect to handle reconnects
    gameRef.child('players').on('value', (snapshot) => {
      const players = snapshot.val() || {};
      
      // If we're in an active game and using X/O symbols
      if (gameState.playerSymbol !== 'waiting' && gameState.status === 'active') {
        // If the other player disconnected, update the status
        if (gameState.playerSymbol === 'X' && !players.O) {
          updateStatusMessage("Waiting for player O to rejoin...");
        } else if (gameState.playerSymbol === 'O' && !players.X) {
          updateStatusMessage("Waiting for player X to rejoin...");
        }
      }
    });
    
    // Initialize chat system
    setupChat();
    
    // Clean up listeners when disconnected
    gameRef.onDisconnect().update({
      [`players/${gameState.isCreator ? 'creatorConnected' : 'joinerConnected'}`]: false
    });
  };

  // Modified: Create quick game with matchmaking
  const createQuickGame = () => {
    // Show notification
    showNotification('Looking for opponent...');
    
    // Get game modes
    const modeSelector = document.getElementById('gameModeSelector');
    const isTacticalMode = modeSelector && modeSelector.getAttribute('data-active') === 'tactical';
    const isBlitzMode = document.getElementById('blitzModeCheckbox') && 
                      document.getElementById('blitzModeCheckbox').checked;
    const isGambitMode = document.getElementById('gambitModeCheckbox') && 
                       document.getElementById('gambitModeCheckbox').checked;
    
    // First check if there are any waiting players
    quickMatchRef = database.ref('quickMatches');
    waitingForMatch = true;
    
    quickMatchRef.orderByChild('status').equalTo('waiting')
      .limitToFirst(1)
      .once('value')
      .then((snapshot) => {
        const matchData = snapshot.val();
        
        if (matchData && !gameState.gameActive) {
          // Found a waiting player - join their game
          const matchId = Object.keys(matchData)[0];
          const match = matchData[matchId];
          
          console.log('Found waiting player, joining their game:', matchId);
          
          // Join this player's game
          joinQuickMatch(matchId, match);
        } else {
          // No waiting players, create a new waiting match
          createWaitingMatch(isTacticalMode, isBlitzMode, isGambitMode);
        }
      })
      .catch(error => {
        console.error('Error looking for quick matches:', error);
        showNotification('Error finding a match: ' + error.message);
        waitingForMatch = false;
      });
    
    // Set a timeout for matchmaking (30 seconds)
    matchmakingTimeout = setTimeout(() => {
      if (waitingForMatch) {
        // If still waiting, create an AI game
        createAIGame();
      }
    }, 30000);
  };
  
  // New: Join an existing quick match
  const joinQuickMatch = (matchId, matchData) => {
    // Clear the matchmaking timeout
    if (matchmakingTimeout) {
      clearTimeout(matchmakingTimeout);
      matchmakingTimeout = null;
    }
    
    waitingForMatch = false;
    
    // Setup game data
    const roomCode = matchId;
    gameState.roomCode = roomCode;
    gameState.playerSymbol = 'O'; // Second player is always O
    gameState.isPlayerTurn = false; // X goes first
    gameState.gameActive = true;
    gameState.board = Array(9).fill('');
    gameState.currentTurn = 'X';
    gameState.gameEnded = false;
    gameState.winner = null;
    gameState.isCreator = false;
    gameState.isQuickGame = true;
    
    // Update the match status in Firebase
    quickMatchRef.child(matchId).update({
      status: 'matched',
      player2: gameState.playerName,
      matchedAt: firebase.database.ServerValue.TIMESTAMP
    })
    .then(() => {
      // Create a game reference for updates and moves
      gameRef = database.ref(`quickGames/${roomCode}`);
      
      // Initialize the game in Firebase
      return gameRef.set({
        board: gameState.board,
        currentTurn: 'X',
        status: 'active',
        gameEnded: false,
        winner: null,
        players: {
          X: matchData.player1,
          O: gameState.playerName
        },
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        gameMode: matchData.gameMode || 'classic',
        isBlitzMode: matchData.isBlitzMode || false,
        isGambitMode: matchData.isGambitMode || false,
        chat: {
          welcome: {
            sender: 'System',
            message: 'Quick Match! Players matched successfully.',
            timestamp: firebase.database.ServerValue.TIMESTAMP
          }
        }
      });
    })
    .then(() => {
      console.log('Joined quick match successfully');
      
      // Set up Firebase listeners
      setupQuickGameListeners();
      
      // Initialize chat
      setupChat();
      
      // Update UI
      gameSetup.classList.remove('active');
      gameBoard.classList.add('active');
      roomCodeDisplay.textContent = 'Quick Match';
      playerSymbol.textContent = 'O';
      
      // Update status
      updateStatusMessage("Opponent's turn! Waiting for X to make a move");
      
      // Show action buttons
      copyRoomBtn.style.display = 'none';
      exitRoomBtn.style.display = 'flex';
      newGameBtn.style.display = 'none';
      
      // Show and collapse chat by default
      const chatContainer = document.querySelector('.chat-container');
      if (chatContainer) {
        chatContainer.classList.add('collapsed');
      }
      
      showNotification('Match found! You are playing as O.');
      
      // Add animation to board
      const boardContainer = document.querySelector('.board-container');
      boardContainer.classList.add('game-starting');
      
      // Remove animation class after transition
      setTimeout(() => {
        boardContainer.classList.remove('game-starting');
      }, 500);
      
      // Set up game mode features if needed
      if (matchData.gameMode === 'tactical' && window.tacticalMode) {
        window.tacticalMode.setGameMode('tactical');
        window.tacticalMode.startTacticalGame();
      }
      
      // Setup blitz mode if needed
      if (matchData.isBlitzMode && window.tacticalMode) {
        window.tacticalMode.state.isBlitzMode = true;
        document.getElementById('blitzTimer').style.display = 'block';
      }
      
      // Setup gambit mode if needed
      if (matchData.isGambitMode && window.tacticalMode) {
        window.tacticalMode.state.isGambitMode = true;
      }
    })
    .catch(error => {
      console.error('Error joining quick match:', error);
      showNotification('Error joining the match: ' + error.message);
      waitingForMatch = false;
    });
  };
  
  // New: Create a waiting match for quick game matchmaking
  const createWaitingMatch = (isTacticalMode, isBlitzMode, isGambitMode) => {
    // Generate a unique ID
    const matchId = generateRoomCode();
    
    // Create a waiting match entry
    quickMatchRef.child(matchId).set({
      player1: gameState.playerName,
      status: 'waiting',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      gameMode: isTacticalMode ? 'tactical' : 'classic',
      isBlitzMode: isBlitzMode,
      isGambitMode: isGambitMode
    })
    .then(() => {
      console.log('Created waiting match:', matchId);
      
      // Set up game reference for later use
      gameRef = database.ref(`quickGames/${matchId}`);
      
      // Pre-initialize game data (will be completed when player 2 joins)
      return gameRef.set({
        status: 'waiting',
        board: Array(9).fill(''),
        currentTurn: 'X', // First player is always X
        gameEnded: false,
        players: {
          X: gameState.playerName
        },
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        gameMode: isTacticalMode ? 'tactical' : 'classic',
        isBlitzMode: isBlitzMode,
        isGambitMode: isGambitMode,
        chat: {
          welcome: {
            sender: 'System',
            message: 'Waiting for an opponent to join...',
            timestamp: firebase.database.ServerValue.TIMESTAMP
          }
        }
      });
    })
    .then(() => {
      // Update UI to waiting state
      gameSetup.classList.remove('active');
      gameBoard.classList.add('active');
      roomCodeDisplay.textContent = 'Quick Match';
      playerSymbol.textContent = 'X (Waiting)';
      updateStatusMessage("Looking for an opponent...");
      
      // Show cancel button only
      copyRoomBtn.style.display = 'none';
      exitRoomBtn.style.display = 'flex';
      newGameBtn.style.display = 'none';
      
      // Initialize chat
      setupChat();
      
      // Show and collapse chat by default
      const chatContainer = document.querySelector('.chat-container');
      if (chatContainer) {
        chatContainer.classList.add('collapsed');
      }
      
      // Setup temporary game state
      gameState.roomCode = matchId;
      gameState.isCreator = true;
      gameState.playerSymbol = 'X';
      gameState.isQuickGame = true;
      
      // Listen for changes (someone joining)
      setupQuickGameListeners();
      
      showNotification('Waiting for an opponent. A computer opponent will join if no one is found within 30 seconds.');
      
      // Initialize tactical mode if selected
      if (isTacticalMode && window.tacticalMode) {
        window.tacticalMode.startTacticalGame();
      }
    })
    .catch(error => {
      console.error('Error creating waiting match:', error);
      showNotification('Error setting up game: ' + error.message);
      waitingForMatch = false;
      
      // Clear matchmaking timeout if needed
      if (matchmakingTimeout) {
        clearTimeout(matchmakingTimeout);
        matchmakingTimeout = null;
      }
    });
  };
  
  // New: Create AI game as fallback when no match is found
  const createAIGame = () => {
    // Clear matchmaking state
    waitingForMatch = false;
    
    // If we were waiting, remove our waiting entry
    if (gameState.roomCode && quickMatchRef) {
      quickMatchRef.child(gameState.roomCode).remove()
        .catch(error => console.error('Error removing waiting match:', error));
    }
    
    // Generate a room code for the AI game
    const roomCode = generateRoomCode();
    
    // Setup the player symbol (always X for AI games)
    gameState.roomCode = roomCode;
    gameState.playerSymbol = 'X';
    gameState.isPlayerTurn = true;
    gameState.gameActive = true;
    gameState.board = Array(9).fill('');
    gameState.currentTurn = 'X';
    gameState.gameEnded = false;
    gameState.winner = null;
    gameState.isCreator = true;
    gameState.isQuickGame = true;
    gameState.isAIGame = true;
    
    // Create a reference in Firebase just for saving the game state
    gameRef = database.ref(`aiGames/${roomCode}`);
    
    // Initialize AI game in Firebase 
    gameRef.set({
      status: 'active',
      board: Array(9).fill(''),
      currentTurn: 'X',
      gameEnded: false,
      players: {
        X: gameState.playerName,
        O: 'Computer'
      },
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      isAIGame: true,
      chat: {
        welcome: {
          sender: 'System',
          message: 'Playing against the computer. You go first!',
          timestamp: firebase.database.ServerValue.TIMESTAMP
        }
      }
    })
    .then(() => {
      // Update UI
      gameSetup.classList.remove('active');
      gameBoard.classList.add('active');
      roomCodeDisplay.textContent = 'AI Match';
      playerSymbol.textContent = 'X';
      
      // Update status
      updateStatusMessage("Your turn! Select a cell to play");
      
      // Show action buttons
      copyRoomBtn.style.display = 'none';
      exitRoomBtn.style.display = 'flex';
      newGameBtn.style.display = 'flex';
      
      // Initialize chat
      setupChat();
      
      // Add AI welcome message
      setTimeout(() => {
        // Add welcome message from AI
        if (chatRef) {
          chatRef.push({
            sender: 'Computer',
            symbol: 'O',
            message: 'Hello! I will play as O. Good luck!',
            timestamp: firebase.database.ServerValue.TIMESTAMP
          });
        }
        
        // Show and collapse chat by default
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
          chatContainer.classList.add('collapsed');
        }
      }, 1000);
      
      showNotification('No players found. Starting AI game!');
    })
    .catch(error => {
      console.error('Error setting up AI game:', error);
      showNotification('Error starting AI game: ' + error.message);
    });
  };

  // AI Chat Response
  const getAIChatResponse = (message) => {
    if (!gameState.isAIGame) return;
    
    // Simulate AI thinking - randomize response time between 1-3 seconds
    const thinkingTime = 1000 + Math.random() * 2000;
    
    setTimeout(() => {
      if (!chatRef) return;
      
      let response = '';
      
      // Check for common greetings and game state
      if (/hi|hello|hey/i.test(message)) {
        response = getRandomResponse([
          "Hello there! Ready to lose? 😉",
          "Hi! Let's have a good game!",
          "Hey! I'm feeling lucky today!"
        ]);
      } else if (/how are you|how's it going/i.test(message)) {
        response = getRandomResponse([
          "I'm made of code, so I'm always running smoothly!",
          "I'm doing great! Ready to play my best!",
          "All systems operational and ready to win!"
        ]);
      } else if (/good game|gg|well played|wp/i.test(message)) {
        response = getRandomResponse([
          "Thanks! You're a worthy opponent!",
          "GG indeed! That was fun!",
          "Well played! Want to go again?"
        ]);
      } else if (/easy|too easy|simple/i.test(message)) {
        response = getRandomResponse([
          "Oh really? I'm just warming up!",
          "You won't find me so easy next time!",
          "I'm learning your strategy now..."
        ]);
      } else if (/difficult|hard|tough/i.test(message)) {
        response = getRandomResponse([
          "I've been practicing my algorithms!",
          "Thanks! I'm programmed to give you a challenge!",
          "Just wait until I activate my advanced strategies!"
        ]);
      } else if (gameState.gameEnded) {
        if (gameState.winner && gameState.winner.winner === 'Draw') {
          response = getRandomResponse([
            "Great minds think alike! That's why we tied.",
            "A draw! You're as smart as my algorithms!",
            "Perfectly balanced, as all things should be."
          ]);
        } else if (gameState.winner && gameState.winner.winner === 'O') {
          response = getRandomResponse([
            "Victory is mine! Want to try again?",
            "My algorithms predicted this outcome! GG!",
            "The computer prevails this time! 🤖"
          ]);
        } else if (gameState.winner && gameState.winner.winner === 'X') {
          response = getRandomResponse([
            "You won fair and square. Well played!",
            "You're good! I need to update my strategies.",
            "Congratulations! You've defeated me this time."
          ]);
        }
      } else if (/your turn|go|move/i.test(message) && gameState.currentTurn === 'O') {
        response = getRandomResponse([
          "I'm thinking... give me a moment!",
          "Calculating the optimal move...",
          "Let me find the best strategy..."
        ]);
      } else if (/your turn|go|move/i.test(message) && gameState.currentTurn === 'X') {
        response = getRandomResponse([
          "It's your turn now!",
          "I'm waiting for your move!",
          "The board awaits your decision."
        ]);
      } else {
        // Generic responses for messages that don't match specific patterns
        response = getRandomResponse([
          "Let's focus on the game!",
          "I'm processing your strategy...",
          "Interesting move pattern you've got there!",
          "I'm designed to provide a challenging game experience!",
          "My AI is constantly learning. Thanks for playing with me!"
        ]);
      }
      
      // Send AI response
      chatRef.push({
        sender: 'Computer',
        symbol: 'O',
        message: response,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
    }, thinkingTime);
  };
  
  // Helper to get random response from array
  const getRandomResponse = (responses) => {
    const index = Math.floor(Math.random() * responses.length);
    return responses[index];
  };

  // CPU player move (simple AI for quick games)
  const makeCpuMove = () => {
    if (!gameState.isQuickGame || !gameState.isAIGame || gameState.gameEnded || gameState.isPlayerTurn) return;
    
    // Add a small delay to make it feel more natural
    setTimeout(() => {
      // Simple AI: First try to win, then block player, then pick center, then random
      let bestMove = -1;
      
      // Check for winning move
      for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
          // Try this move
          const testBoard = [...gameState.board];
          testBoard[i] = 'O';
          
          // Check if it's a winning move
          const result = checkWin(testBoard);
          if (result && result.winner === 'O') {
            bestMove = i;
            break;
          }
        }
      }
      
      // Block player's winning move
      if (bestMove === -1) {
        for (let i = 0; i < 9; i++) {
          if (gameState.board[i] === '') {
            // Try this move for the player
            const testBoard = [...gameState.board];
            testBoard[i] = 'X';
            
            // Check if it would be a winning move for the player
            const result = checkWin(testBoard);
            if (result && result.winner === 'X') {
              bestMove = i;
              break;
            }
          }
        }
      }
      
      // Take center if available
      if (bestMove === -1 && gameState.board[4] === '') {
        bestMove = 4;
      }
      
      // Take a random available move
      if (bestMove === -1) {
        const availableMoves = [];
        for (let i = 0; i < 9; i++) {
          if (gameState.board[i] === '') {
            availableMoves.push(i);
          }
        }
        
        if (availableMoves.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableMoves.length);
          bestMove = availableMoves[randomIndex];
        }
      }
      
      // Make the CPU move
      if (bestMove !== -1) {
        const newBoard = [...gameState.board];
        newBoard[bestMove] = 'O';
        
        // Animate the CPU move
        const cell = boardCells[bestMove];
        cell.classList.add('cpu-move-animation');
        
        // Update game state
        gameState.board = newBoard;
        gameState.currentTurn = 'X';
        gameState.isPlayerTurn = true;
        
        // Remove animation class after transition
        setTimeout(() => {
          cell.classList.remove('cpu-move-animation');
          cell.classList.add('o-move');
        }, 300);
        
        // Check for win/draw
        const result = checkWin(newBoard);
        if (result) {
          gameState.gameEnded = true;
          gameState.winner = result;
          
          if (result.winner === 'Draw') {
            updateStatusMessage("Game ended in a draw!");
          } else {
            updateStatusMessage("Computer won!");
            
            // Highlight winning cells
            if (result.line) {
              result.line.forEach(index => {
                boardCells[index].classList.add('winner');
              });
            }
          }
          
          // Show new game button
          newGameBtn.style.display = 'flex';
        } else {
          updateStatusMessage("Your turn!");
        }
      }
    }, 700); // Delay to make it feel more natural
  };
  
  // New: Setup listeners for quick games
  const setupQuickGameListeners = () => {
    if (!gameRef) return;
    
    // Listen for game updates
    gameRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      
      // Update local game state
      gameState.board = data.board || gameState.board;
      gameState.currentTurn = data.currentTurn || gameState.currentTurn;
      gameState.gameEnded = data.gameEnded || false;
      gameState.winner = data.winner || null;
      
      // Update scores
      if (data.playerXScore !== undefined) {
        gameState.playerXScore = data.playerXScore;
      }
      
      if (data.playerOScore !== undefined) {
        gameState.playerOScore = data.playerOScore;
      }
      
      // Update turn status
      gameState.isPlayerTurn = gameState.currentTurn === gameState.playerSymbol;
      
      // Render the updated board
      renderBoard();
      
      // Update game status
      if (gameState.gameEnded) {
        if (gameState.winner && gameState.winner.winner === 'Draw') {
          updateStatusMessage("Game ended in a draw!");
        } else if (gameState.winner) {
          if (gameState.winner.winner === gameState.playerSymbol) {
            updateStatusMessage("You won! 🎉");
          } else {
            updateStatusMessage("Opponent won!");
          }
          
          // Highlight winning cells
          if (gameState.winner.line) {
            gameState.winner.line.forEach(index => {
              boardCells[index].classList.add('winner');
            });
          }
        }
        
        // Show new game button
        newGameBtn.style.display = 'flex';
      } else {
        if (gameState.isPlayerTurn) {
          updateStatusMessage("Your turn!");
        } else {
          updateStatusMessage("Opponent's turn...");
        }
      }
    });
    
    // Initialize chat system
    setupChat();
    
    // Clean up listeners when disconnected
    gameRef.onDisconnect().update({
      [`players/${gameState.playerSymbol}`]: null
    });
  };

  // Modified: makeMove function to handle quick games with real players
  const makeMove = (index) => {
    // Check if it's a valid move
    if (
      !gameState.gameActive ||
      !gameState.isPlayerTurn || 
      gameState.board[index] !== '' || 
      gameState.gameEnded
    ) {
      return;
    }
    
    // For AI quick games
    if (gameState.isQuickGame && gameState.isAIGame) {
      // Update local state
      const newBoard = [...gameState.board];
      newBoard[index] = gameState.playerSymbol;
      gameState.board = newBoard;
      gameState.currentTurn = 'O';
      gameState.isPlayerTurn = false;
      
      // Update UI
      boardCells[index].classList.add('x-move');
      
      // Check for win/draw
      const result = checkWin(newBoard);
      if (result) {
        gameState.gameEnded = true;
        gameState.winner = result;
        
        if (result.winner === 'Draw') {
          updateStatusMessage("Game ended in a draw!");
        } else {
          updateStatusMessage("You won! 🎉");
          
          // Highlight winning cells
          if (result.line) {
            result.line.forEach(index => {
              boardCells[index].classList.add('winner');
            });
          }
        }
        
        // Show new game button
        newGameBtn.style.display = 'flex';
      } else {
        updateStatusMessage("Computer's turn...");
        makeCpuMove();
      }
      
      return;
    }
    
    // For quick games with real players
    if (gameState.isQuickGame && !gameState.isAIGame) {
      // Update local state first
      const newBoard = [...gameState.board];
      newBoard[index] = gameState.playerSymbol;
      
      // Check for win/draw
      const result = checkWin(newBoard);
      
      // Prepare the update object for Firebase
      const updateData = {
        board: newBoard,
        currentTurn: gameState.playerSymbol === 'X' ? 'O' : 'X',
        gameEnded: result !== null,
        winner: result
      };
      
      // Add score updates if there is a winner
      if (result && result.winner !== 'Draw') {
        if (result.winner === 'X') {
          updateData.playerXScore = gameState.playerXScore;
        } else if (result.winner === 'O') {
          updateData.playerOScore = gameState.playerOScore;
        }
      }
      
      // Update Firebase
      if (gameRef) {
        gameRef.update(updateData);
        
        // Record the move
        movesRef.push({
          player: gameState.playerSymbol,
          position: index,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        });
      }
      
      return;
    }
    
    // If in tactical mode, use tactical move logic
    if (window.tacticalMode && window.tacticalMode.state.gameMode === 'tactical') {
      const moveResult = window.tacticalMode.makeTacticalMove(index);
      
      // If the tactical move was successful, update Firebase
      if (moveResult) {
        // Update Firebase - in a more complete implementation, we would 
        // need to sync the tactical game state with Firebase as well
        if (gameRef) {
          // For simplicity, we're still updating the regular board state
          const newBoard = [...gameState.board];
          newBoard[index] = gameState.playerSymbol;
          
          gameRef.update({
            board: newBoard,
            currentTurn: gameState.playerSymbol === 'X' ? 'O' : 'X'
          });
          
          // Record the move
          movesRef.push({
            player: gameState.playerSymbol,
            position: index,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            tacticalAction: window.tacticalMode.state.currentAction
          });
        }
        
        // If in blitz mode, restart the timer
        if (window.tacticalMode.state.isBlitzMode) {
          startBlitzTimer();
        }
      }
      
      return;
    }
    
    // Regular move in classic mode
    // Update local state
    const newBoard = [...gameState.board];
    newBoard[index] = gameState.playerSymbol;
    
    // Check for win/draw
    const result = checkWin(newBoard);
    
    // Prepare the update object for Firebase
    const updateData = {
      board: newBoard,
      currentTurn: gameState.playerSymbol === 'X' ? 'O' : 'X',
      gameEnded: result !== null,
      winner: result
    };
    
    // Add score updates if there is a winner
    if (result && result.winner !== 'Draw') {
      if (result.winner === 'X') {
        updateData.playerXScore = gameState.playerXScore;
      } else if (result.winner === 'O') {
        updateData.playerOScore = gameState.playerOScore;
      }
    }
    
    // Update Firebase
    if (gameRef) {
      gameRef.update(updateData);
      
      // Record the move
      movesRef.push({
        player: gameState.playerSymbol,
        position: index,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
    }
  };

  // Modified: resetGame function to handle quick games with real players
  const resetGame = () => {
    if (gameState.isQuickGame && gameState.isAIGame) {
      // Reset the local game state for AI games
      gameState.board = Array(9).fill('');
      gameState.currentTurn = 'X';
      gameState.isPlayerTurn = true;
      gameState.gameEnded = false;
      gameState.winner = null;
      
      // Reset UI
      boardCells.forEach(cell => {
        cell.classList.remove('x-move', 'o-move', 'winner', 'cpu-move-animation');
      });
      
      updateStatusMessage("Your turn! Select a cell to play");
      showNotification('New game! Start playing 👍');
      return;
    }
    
    if (gameState.isQuickGame && !gameState.isAIGame) {
      // Only the X player (creator) can reset
      if (gameState.playerSymbol !== 'X') {
        showNotification("Only the X player can start a new game");
        return;
      }
      
      // Only allow resetting if the game has ended
      if (!gameState.gameEnded) {
        showNotification("Can't reset until game is finished");
        return;
      }
      
      // Reset the board
      if (gameRef) {
        const resetData = {
          board: Array(9).fill(''),
          currentTurn: 'X',
          gameEnded: false,
          winner: null,
          status: 'active'
        };
        
        gameRef.update(resetData)
          .then(() => {
            showNotification('Starting a new game');
          })
          .catch(error => {
            console.error('Error resetting game:', error);
            showNotification('Error: ' + error.message);
          });
      }
      
      return;
    }
    
    // Original logic for online games
    if (!gameRef) return;
    
    // Only allow resetting if the game has ended
    if (!gameState.gameEnded) {
      showNotification("Can't reset until game is finished");
      return;
    }
    
    // Reset the board
    const resetData = {
      board: Array(9).fill(''),
      currentTurn: 'X',
      gameEnded: false,
      winner: null,
      status: 'active'
    };
    
    // If in tactical mode, reset that too
    if (window.tacticalMode && window.tacticalMode.state.gameMode === 'tactical') {
      window.tacticalMode.resetGame();
    }
    
    gameRef.update(resetData);
    
    showNotification('Starting a new game');
  };

  // Modified: exitRoom function to handle quick games with real players
  const exitRoom = () => {
    if (gameState.isQuickGame && gameState.isAIGame) {
      // ... existing AI game exit logic ...
      return;
    }
    
    if (gameState.isQuickGame && !gameState.isAIGame) {
      // If we're still waiting for a match
      if (waitingForMatch) {
        // Clear timeout
        if (matchmakingTimeout) {
          clearTimeout(matchmakingTimeout);
          matchmakingTimeout = null;
        }
        
        // Remove waiting match if we created one
        if (gameState.roomCode && quickMatchRef) {
          quickMatchRef.child(gameState.roomCode).remove()
            .catch(error => console.error('Error removing waiting match:', error));
        }
        
        waitingForMatch = false;
      }
      
      // If we were in an active game, update players
      if (gameRef) {
        gameRef.child('players').once('value')
          .then((snapshot) => {
            const players = snapshot.val() || {};
            
            // Create new players without this player
            const updatedPlayers = { ...players };
            delete updatedPlayers[gameState.playerSymbol];
            
            // Update Firebase
            return gameRef.child('players').set(updatedPlayers);
          })
      .then(() => {
            // Unsubscribe from listeners
            gameRef.off();
          })
          .catch(error => {
            console.error('Error updating players:', error);
          });
      }
      
      // Reset UI and game state
      gameBoard.classList.remove('active');
      gameSetup.classList.add('active');
      roomCodeDisplay.textContent = '-';
      playerSymbol.textContent = '-';
      updateStatusMessage('Create a new game or join an existing one');
      
      // Reset game board UI
      boardCells.forEach(cell => {
        cell.classList.remove('x-move', 'o-move', 'winner', 'cpu-move-animation');
      });
      
      // Reset game state
      gameState = {
        roomCode: null,
        playerSymbol: null,
        isPlayerTurn: false,
        gameActive: false,
        board: Array(9).fill(''),
        currentTurn: 'X',
        gameEnded: false,
        winner: null,
        playerName: gameState.playerName,
        isCreator: false,
        readyState: {
          creator: false,
          joiner: false
        },
        isQuickGame: false,
        isAIGame: false
      };
      
      // Hide game action buttons
      copyRoomBtn.style.display = 'none';
      exitRoomBtn.style.display = 'none';
      newGameBtn.style.display = 'none';
      
      showNotification('You left the game');
      return;
    }
    
    // Original logic for online games
    if (!gameRef) {
      showNotification('Not currently in a game');
      return;
    }
    
    // Handle player removal from Firebase
    if (gameRef) {
      // First get the current players
      gameRef.child('players').once('value')
        .then((snapshot) => {
          const players = snapshot.val() || {};
          
          // If we're using symbols X/O
          if (gameState.playerSymbol === 'X' || gameState.playerSymbol === 'O') {
            // Create new players without this player
            const updatedPlayers = { ...players };
            delete updatedPlayers[gameState.playerSymbol];
            
            // Update Firebase with the new players list
            return gameRef.child('players').set(updatedPlayers);
          } 
          // If we're creator/joiner
          else if (gameState.isCreator) {
            const updatedPlayers = { ...players };
            delete updatedPlayers.creator;
            return gameRef.child('players').set(updatedPlayers);
          } else {
            const updatedPlayers = { ...players };
            delete updatedPlayers.joiner;
            return gameRef.child('players').set(updatedPlayers);
          }
        })
        .then(() => {
          // Unsubscribe from listeners
          gameRef.off();
          if (movesRef) movesRef.off();
          
          // Reset game state
          gameState = {
            roomCode: null,
            playerSymbol: null,
            isPlayerTurn: false,
            gameActive: false,
            board: Array(9).fill(''),
            currentTurn: 'X',
            gameEnded: false,
            winner: null,
            playerName: gameState.playerName,
            isCreator: false,
            readyState: {
              creator: false,
              joiner: false
            },
            isQuickGame: false,
            isAIGame: false
          };
          
          // Update UI
          gameBoard.classList.remove('active');
          gameSetup.classList.add('active');
          roomCodeDisplay.textContent = '-';
          playerSymbol.textContent = '-';
          updateStatusMessage('Create a new game or join an existing one');
          
          // Reset game board UI
          boardCells.forEach(cell => {
            cell.classList.remove('x-move', 'o-move', 'winner');
          });
          
          // If tactical mode exists
            if (window.tacticalMode) {
            try {
              // Reset cells related to tactical mode
              boardCells.forEach(cell => {
              cell.classList.remove('shield', 'power-tile', 'bomb-tile', 'swap-tile', 'lock-tile', 'bomb-active');
              });
              
              const tacticalBadge = document.getElementById('tacticalBadge');
              const actionPanel = document.getElementById('actionPanel');
              const blitzTimer = document.getElementById('blitzTimer');
              const gameStats = document.getElementById('gameStats');
              const replayContainer = document.getElementById('replayContainer');
              
              // Use safe access to DOM elements with null checks
              if (tacticalBadge) tacticalBadge.style.display = 'none';
              if (actionPanel) actionPanel.classList.remove('active');
              if (blitzTimer) blitzTimer.style.display = 'none';
              if (gameStats) gameStats.style.display = 'none';
              if (replayContainer) replayContainer.style.display = 'none';
              
              // Set the game mode safely
              window.tacticalMode.setGameMode('classic');
            } catch (error) {
              console.error('Error cleaning up tactical mode:', error);
            }
          }
          
          // Hide game action buttons
          copyRoomBtn.style.display = 'none';
          exitRoomBtn.style.display = 'none';
          newGameBtn.style.display = 'none';
          
          // Remove ready button if present
          const readyBtn = document.getElementById('readyBtn');
          if (readyBtn && readyBtn.parentNode) {
            readyBtn.parentNode.removeChild(readyBtn);
          }
          
          showNotification('Successfully left the game');
        })
        .catch(error => {
          console.error('Error leaving game:', error);
          showNotification('Error leaving game: ' + error.message);
        });
    } else {
      // Just reset UI if there's no Firebase connection
      gameBoard.classList.remove('active');
      gameSetup.classList.add('active');
      updateStatusMessage('Create a new game or join an existing one');
      showNotification('Left the game');
    }
  };

  // Copy room code to clipboard
  const copyRoomCode = () => {
    if (!gameState.roomCode) return;
    
    // Use clipboard API
    navigator.clipboard.writeText(gameState.roomCode)
      .then(() => {
        showNotification('Room code copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy room code: ', err);
        // Fallback
        const input = document.createElement('input');
        input.value = gameState.roomCode;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showNotification('Room code copied to clipboard!');
      });
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    
    // Update icon
    darkModeToggle.innerHTML = isDarkMode 
      ? '<i class="fas fa-sun"></i>' 
      : '<i class="fas fa-moon"></i>';
  };

  // Setup chat for game room
  const setupChat = () => {
    if (!gameRef) return;
    
    const chatContainer = document.querySelector('.chat-container');
    const chatHeader = document.querySelector('.chat-header');
    const toggleChatBtn = document.getElementById('toggleChatBtn');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    
    // Initialize chat reference
    chatRef = gameRef.child('chat');
    
    // Toggle chat visibility
    if (toggleChatBtn && chatContainer) {
      toggleChatBtn.addEventListener('click', () => {
        chatContainer.classList.toggle('collapsed');
        
        // If we're expanding and there are unread messages, clear them
        if (!chatContainer.classList.contains('collapsed') && unreadMessages > 0) {
          clearChatNotification();
        }
      });
      
      chatHeader.addEventListener('click', (e) => {
        // Don't toggle if clicking the toggle button (it has its own handler)
        if (e.target !== toggleChatBtn && !toggleChatBtn.contains(e.target)) {
          chatContainer.classList.toggle('collapsed');
          
          // If we're expanding and there are unread messages, clear them
          if (!chatContainer.classList.contains('collapsed') && unreadMessages > 0) {
            clearChatNotification();
          }
        }
      });
    }
    
    // Function to send a message
    const sendMessage = () => {
      const message = chatInput.value.trim();
      
      if (message && chatRef) {
        // Add message to chat
        chatRef.push({
          sender: gameState.playerName,
          symbol: gameState.playerSymbol,
          message: message,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Clear input
        chatInput.value = '';
        
        // If playing against AI, get AI response
        if (gameState.isAIGame) {
          getAIChatResponse(message);
        }
      }
    };
    
    // Send message on button click
    if (sendChatBtn) {
      sendChatBtn.addEventListener('click', sendMessage);
    }
    
    // Send message on Enter key
    if (chatInput) {
      chatInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });
    }
    
    // Listen for new messages
    chatRef.on('child_added', (snapshot) => {
      const message = snapshot.val();
      addMessageToChat(message);
    });
  };
  
  // Add message to chat UI
  const addMessageToChat = (message) => {
    const chatMessages = document.getElementById('chatMessages');
    const chatContainer = document.querySelector('.chat-container');
    
    if (!chatMessages) return;
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    // Determine if sent or received
    const isSent = message.sender === gameState.playerName;
    messageElement.classList.add(isSent ? 'sent' : 'received');
    
    // Format timestamp
    const timestamp = new Date(message.timestamp);
    const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Create message content
    const senderSymbol = message.symbol ? ` (${message.symbol})` : '';
    messageElement.innerHTML = `
      <div class="message-sender">${message.sender}${senderSymbol}</div>
      <div class="message-content">${escapeHTML(message.message)}</div>
      <div class="message-time">${formattedTime}</div>
    `;
    
    // Add to chat
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Show notification if chat is collapsed
    if (chatContainer && chatContainer.classList.contains('collapsed') && !isSent) {
      showChatNotification();
    }
  };
  
  // Escape HTML to prevent XSS
  const escapeHTML = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
  // Show notification for new messages
  const showChatNotification = () => {
    const chatHeader = document.querySelector('.chat-header h3');
    if (!chatHeader) return;
    
    // Increment unread count
    unreadMessages++;
    
    // Check if badge already exists
    let badge = chatHeader.querySelector('.notification-badge');
    
    if (!badge) {
      // Create a new badge
      badge = document.createElement('span');
      badge.className = 'notification-badge';
      chatHeader.appendChild(badge);
    }
    
    // Update badge count
    badge.textContent = unreadMessages;
  };
  
  // Clear chat notification
  const clearChatNotification = () => {
    const chatHeader = document.querySelector('.chat-header h3');
    if (!chatHeader) return;
    
    // Reset unread count
    unreadMessages = 0;
    
    // Remove badge if it exists
    const badge = chatHeader.querySelector('.notification-badge');
    if (badge) {
      chatHeader.removeChild(badge);
    }
  };

  // Event Listeners
  createGameBtn.addEventListener('click', createGame);
  
  // Quick Game button event handler
  const quickGameBtn = document.getElementById('quickGameBtn');
  if (quickGameBtn) {
    quickGameBtn.addEventListener('click', createQuickGame);
  }
  
  joinGameBtn.addEventListener('click', () => {
    joinGame(joinGameInput.value.trim());
  });
  
  joinGameInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      joinGame(joinGameInput.value.trim());
    }
  });
  
  // Game board click handler
  boardCells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
      makeMove(index);
    });
  });
  
  // Button event handlers
  copyRoomBtn.addEventListener('click', copyRoomCode);
  exitRoomBtn.addEventListener('click', exitRoom);
  newGameBtn.addEventListener('click', resetGame);
  darkModeToggle.addEventListener('click', toggleDarkMode);

  // Initialize the UI
  initUI();
}); 