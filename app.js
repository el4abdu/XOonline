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
    isAIGame: false
  };

  // References
  let gameRef = null;
  let movesRef = null;
  let quickMatchRef = null;
  let waitingForMatch = false;
  let matchmakingTimeout = null;

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

  // Update notification system to use modern animation
  function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    
    // Clear any existing notification
    clearTimeout(notificationTimeout);
    
    // Set message and show notification
    notificationMessage.textContent = message;
    
    // Add type class for styling
    notification.className = 'notification';
    notification.classList.add(`notification-${type}`);
    
    // Add entrance animation
    notification.classList.add('notification-show');
    
    // Auto-hide after delay
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('notification-show');
        notification.classList.add('notification-hide');
        
        // Remove hide class after animation completes
    setTimeout(() => {
            notification.classList.remove('notification-hide');
        }, 500);
    }, 3000);
  }

  // Render the board based on current game state
  const renderBoard = () => {
    boardCells.forEach((cell, index) => {
      // Clear existing classes
      cell.classList.remove('x-move', 'o-move', 'winner');
      
      // Add appropriate class based on move
      if (gameState.board[index] === 'X') {
        cell.classList.add('x-move');
      } else if (gameState.board[index] === 'O') {
        cell.classList.add('o-move');
      }
      
      // Highlight winning cells
      if (gameState.winner && gameState.winner.line && gameState.winner.line.includes(index)) {
        cell.classList.add('winner');
      }
    });
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
    
    // Test the Firebase connection first
    database.ref('.info/connected').once('value')
      .then((snapshot) => {
        if (snapshot.val() === true) {
          console.log('Connected to Firebase successfully');
          
          // Add tactical mode info to the game data if needed
          const gameData = {
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            status: 'waiting',
            currentTurn: 'X', // Will be randomized after both players join
            players: {
              creator: gameState.playerName // Just store as creator first, will update with X/O later
            },
            readyState: {
              creator: false, // Creator will mark ready when player 2 joins
              joiner: false
            },
            board: gameState.board,
            gameEnded: false,
            winner: null
          };
          
          if (isTacticalMode) {
            gameData.gameMode = 'tactical';
            gameData.isBlitzMode = window.tacticalMode.state.isBlitzMode;
            gameData.isGambitMode = window.tacticalMode.state.isGambitMode;
          }
          
          return gameRef.set(gameData);
        } else {
          throw new Error('Not connected to Firebase');
        }
      })
      .then(() => {
        console.log('Game created successfully with code:', roomCode);
        
        // Listen for changes
        setupGameListeners();

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
        
        // Show ready button (will be enabled when player 2 joins)
        createReadyButton();
        
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

  // Update ready button creation to use the modern button style
  function createReadyButton() {
    const actionsDiv = document.querySelector('.action-buttons');
    
    // Clear previous buttons
    actionsDiv.innerHTML = '';
    
    // Create new button with modern style
    const readyBtn = document.createElement('button');
    readyBtn.id = 'readyBtn';
    readyBtn.className = 'ready-btn';
    
    // Create button structure
    const buttonTop = document.createElement('div');
    buttonTop.className = 'button-top';
    buttonTop.innerHTML = 'I\'m Ready';
    
    const buttonBottom = document.createElement('div');
    buttonBottom.className = 'button-bottom';
    
    const buttonBase = document.createElement('div');
    buttonBase.className = 'button-base';
    
    // Append button parts
    readyBtn.appendChild(buttonTop);
    readyBtn.appendChild(buttonBottom);
    readyBtn.appendChild(buttonBase);
    
    // Add event listener
    readyBtn.addEventListener('click', markPlayerReady);
    
    // Append to container
    actionsDiv.appendChild(readyBtn);
    actionsDiv.style.display = 'flex';
  }

  // Update mark player ready function to handle new button structure
  function markPlayerReady() {
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
          gameStartedAt: firebase.database.ServerValue.TIMESTAMP
        })
        .then(() => {
          // Update local game state
          gameState.playerSymbol = creatorGetsX ? 'X' : 'O';
          gameState.isPlayerTurn = firstTurn === gameState.playerSymbol;
          gameState.currentTurn = firstTurn;
          
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
      showNotification('Please enter a valid room code');
      return;
    }

    // Show notification that we're trying to join
    showNotification('Trying to join game...');
    
    // Check if game exists
    const checkGameRef = database.ref(`games/${roomCode}`);
    
    checkGameRef.once('value')
      .then((snapshot) => {
        const gameData = snapshot.val();
        
        if (!gameData) {
          showNotification('Game not found. Check the room code.');
          console.error('Game not found:', roomCode);
          return;
        }
        
        console.log('Found game data:', JSON.stringify(gameData));
        
        // Check if the game is tactical mode and set up accordingly
        if (gameData.gameMode === 'tactical' && window.tacticalMode) {
          window.tacticalMode.setGameMode('tactical');
          
          if (gameData.isBlitzMode) {
            document.getElementById('blitzModeCheckbox').checked = true;
            window.tacticalMode.state.isBlitzMode = true;
          }
          
          if (gameData.isGambitMode) {
            document.getElementById('gambitModeCheckbox').checked = true;
            window.tacticalMode.state.isGambitMode = true;
          }
        }
        
        if (gameData.status === 'waiting') {
          // This is player 2 joining a waiting game
          gameState.roomCode = roomCode;
          gameState.playerSymbol = 'waiting'; // Will be assigned when game starts
          gameState.isPlayerTurn = false;
          gameState.board = gameData.board || Array(9).fill('');
          gameState.currentTurn = gameData.currentTurn || 'X';
          gameState.gameEnded = gameData.gameEnded || false;
          gameState.winner = gameData.winner || null;
          gameState.gameActive = true;
          gameState.isCreator = false;
          
          // Update game in Firebase
          gameRef = database.ref(`games/${roomCode}`);
          movesRef = gameRef.child('moves');
          
          // Get existing data and update safely
          gameRef.once('value')
            .then((snapshot) => {
              const fullGameData = snapshot.val() || {};
              
              // Create a clean players object
              const updatedPlayers = {};
              
              // Preserve creator
              if (fullGameData.players && fullGameData.players.creator) {
                updatedPlayers.creator = fullGameData.players.creator;
              }
              
              // Add joiner
              updatedPlayers.joiner = gameState.playerName;
              
              // Create a complete update object
              const completeUpdate = {
                ...fullGameData,
                players: updatedPlayers
              };
              
              // Set the entire state or just update players node
              return gameRef.child('players').set(updatedPlayers);
            })
          .then(() => {
              console.log('Successfully joined game');
            
            // Listen for changes
            setupGameListeners();
            
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
              
              // Show ready button for player 2
              createReadyButton();
            
            // Initialize tactical mode if needed
            if (gameData.gameMode === 'tactical' && window.tacticalMode) {
              window.tacticalMode.startTacticalGame();
            }
            
              // Enable the creator's start button safely
              gameRef.child('readyState').once('value', snapshot => {
                const currentReadyState = snapshot.val() || {};
                currentReadyState.creatorCanStart = true;
                return gameRef.child('readyState').set(currentReadyState);
              })
              .then(() => {
                showNotification('Joined the game successfully! Press Ready when you are ready to play.');
              });
          })
          .catch(error => {
            console.error('Failed to update game status:', error);
            showNotification('Error joining game: ' + error.message);
          });
        } else if (gameData.status === 'active') {
          // Check if we can reconnect as a player
          const players = gameData.players || {};
          
          if (!players.X || !players.O) {
            // Can join as the missing player
            const availableSymbol = !players.X ? 'X' : 'O';
            
            gameState.roomCode = roomCode;
            gameState.playerSymbol = availableSymbol;
            gameState.isPlayerTurn = gameData.currentTurn === availableSymbol;
            gameState.board = gameData.board || Array(9).fill('');
            gameState.currentTurn = gameData.currentTurn || 'X';
            gameState.gameEnded = gameData.gameEnded || false;
            gameState.winner = gameData.winner || null;
            gameState.gameActive = true;
            
            // Update game in Firebase
            gameRef = database.ref(`games/${roomCode}`);
            movesRef = gameRef.child('moves');
            
            // Method 1: Using set instead of update for the players node
            gameRef.child('players').once('value')
              .then((snapshot) => {
                // Carefully build a clean players object
                const currentPlayers = {};
                const existingPlayers = snapshot.val() || {};
                
                // Copy existing player (if any)
                if (availableSymbol === 'X' && existingPlayers.O) {
                  currentPlayers.O = existingPlayers.O;
                } else if (availableSymbol === 'O' && existingPlayers.X) {
                  currentPlayers.X = existingPlayers.X;
                }
                
                // Add new player safely
                currentPlayers[availableSymbol] = gameState.playerName;
                
                // Set the entire players object (not using update with dot notation)
                return gameRef.child('players').set(currentPlayers);
              })
              .then(() => {
                console.log('Successfully reconnected as player:', availableSymbol);
                
                // Listen for changes
                setupGameListeners();
                
                // Update UI
                gameSetup.classList.remove('active');
                gameBoard.classList.add('active');
                roomCodeDisplay.textContent = roomCode;
                playerSymbol.textContent = availableSymbol;
                updateStatusMessage(`${gameData.currentTurn}'s turn`);
                
                // Show action buttons
                copyRoomBtn.style.display = 'flex';
                exitRoomBtn.style.display = 'flex';
                newGameBtn.style.display = 'flex';
                
                // Initialize tactical mode if needed
                if (gameData.gameMode === 'tactical' && window.tacticalMode) {
                  window.tacticalMode.startTacticalGame();
                }
                
                showNotification(`Joined as Player ${availableSymbol}`);
              })
              .catch(error => {
                console.error('Failed to update player info:', error);
                showNotification('Error joining game: ' + error.message);
              });
          } else {
            showNotification('Game is already full');
          }
        } else {
          showNotification('Cannot join this game - invalid status');
          console.error('Invalid game status:', gameData.status);
        }
      })
      .catch((error) => {
        console.error("Error joining game:", error);
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
          readyBtn.textContent = 'Start Game';
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
        isGambitMode: matchData.isGambitMode || false
      });
    })
    .then(() => {
      console.log('Joined quick match successfully');
      
      // Set up Firebase listeners
      setupQuickGameListeners();
      
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
      
      // Setup temporary game state
      gameState.roomCode = matchId;
      gameState.isCreator = true;
      gameState.playerSymbol = 'X';
      gameState.isQuickGame = true;
      
      // Listen for match
      const matchListener = quickMatchRef.child(matchId).on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (!data) {
          // Match was deleted
          quickMatchRef.child(matchId).off('value', matchListener);
          return;
        }
        
        if (data.status === 'matched' && waitingForMatch) {
          // Someone joined our game!
          waitingForMatch = false;
          
          if (matchmakingTimeout) {
            clearTimeout(matchmakingTimeout);
            matchmakingTimeout = null;
          }
          
          quickMatchRef.child(matchId).off('value', matchListener);
          
          // Initialize the game
          gameRef = database.ref(`quickGames/${matchId}`);
          
          // Set up game state
          gameState.gameActive = true;
          gameState.isPlayerTurn = true;
          
          // Set up listeners
          setupQuickGameListeners();
          
          showNotification('Opponent found! You are playing as X. Your turn!');
          updateStatusMessage("Your turn! Make a move.");
          playerSymbol.textContent = 'X';
          
          // Add animation to board
          const boardContainer = document.querySelector('.board-container');
          boardContainer.classList.add('game-starting');
          
          // Remove animation class after transition
          setTimeout(() => {
            boardContainer.classList.remove('game-starting');
          }, 500);
        }
      });
      
      showNotification('Waiting for opponent... (30s timeout)');
    })
    .catch(error => {
      console.error('Error creating waiting match:', error);
      showNotification('Error creating match: ' + error.message);
      waitingForMatch = false;
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
    
    // Create a local game without Firebase
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
    
    showNotification('No players found. Starting AI game!');
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
  };

  // Make a move
  const makeMove = (index) => {
    // Don't process a move if the game has ended
    if (gameState.gameEnded) {
      showNotification('Game over! Start a new game.');
      return;
    }

    // Check if it's a quick game
    if (gameState.isQuickGame) {
      // For quick games, player is always X
      if (gameState.board[index] || gameState.currentTurn !== 'X') {
        return;
      }

      // Update the local board
      gameState.board[index] = 'X';
      
      // Add the flip card effect for tactical mode visual feedback
      const cell = document.querySelector(`.board-cell[data-index="${index}"]`);
      
      // Update cell with modern flip card effect
      const cellInner = cell.querySelector('.board-cell-inner');
      if (cellInner) {
        cell.classList.add('tactical-flip');
        setTimeout(() => {
          cellInner.querySelector('.board-cell-back').classList.add('x-side');
        }, 150);
      }

      // Add X move class and animation
      cell.classList.add('x-move');
      
      // Add tactical effect animation
      const effectElement = document.createElement('div');
      effectElement.classList.add('tactical-effect', 'strike-effect');
      cell.appendChild(effectElement);
      setTimeout(() => effectElement.remove(), 800);

      // Check for a win
      const winner = checkWin(gameState.board);
      if (winner) {
        handleGameEnd(winner);
        return;
      }

      // Check for a draw
      if (!gameState.board.includes(null)) {
        handleGameEnd('draw');
        return;
      }

      // Switch turn to O
      gameState.currentTurn = 'O';
      updateGameStateUI();

      // Wait a moment, then make the CPU move
      setTimeout(() => {
        makeCpuMove();
      }, 700);

      return;
    }

    // If it's not a quick game, check if it's in tactical mode
    if (window.tacticalMode && window.tacticalMode.state.gameMode === 'tactical') {
      // Use tactical mode move logic instead
      const result = window.tacticalMode.makeTacticalMove(index);
      if (result) {
        updateFirebaseGameState();
      }
      return;
    }

    // Regular multiplayer game logic
    if (!gameState.roomCode) {
      showNotification('Please create or join a game first');
      return;
    }

    // Cannot make a move if not your turn
    if (gameState.currentTurn !== gameState.playerSymbol) {
      showNotification('Not your turn yet!');
      return;
    }

    // Cannot move to an occupied cell
    if (gameState.board[index]) {
      showNotification('This cell is already occupied!');
      return;
    }

    // Update the local board
    gameState.board[index] = gameState.playerSymbol;
    
    // Add the flip card effect for visual feedback
    const cell = document.querySelector(`.board-cell[data-index="${index}"]`);
    
    // Update cell with modern flip card effect
    const cellInner = cell.querySelector('.board-cell-inner');
    if (cellInner) {
      cell.classList.add('tactical-flip');
      setTimeout(() => {
        const backFace = cellInner.querySelector('.board-cell-back');
        if (gameState.playerSymbol === 'X') {
          backFace.classList.add('x-side');
        } else {
          backFace.classList.add('o-side');
        }
      }, 150);
    }
    
    // Add symbol class for animations
    cell.classList.add(gameState.playerSymbol === 'X' ? 'x-move' : 'o-move');
    
    // Add tactical effect animation for visual flair
    const effectElement = document.createElement('div');
    effectElement.classList.add('tactical-effect', 'strike-effect');
    cell.appendChild(effectElement);
    setTimeout(() => effectElement.remove(), 800);

    // Check for a win
    const winner = checkWin(gameState.board);
    if (winner) {
      gameState.gameEnded = true;
      gameState.winner = winner;
    }

    // Check for a draw
    if (!gameState.board.includes(null) && !gameState.gameEnded) {
      gameState.gameEnded = true;
      gameState.winner = 'draw';
    }

    // Update the game state in Firebase
    updateFirebaseGameState();

    // Update the game UI
    updateGameStateUI();
  };

  // Reset the game for a new round
  const resetGame = () => {
    gameState.board = [null, null, null, null, null, null, null, null, null];
    gameState.gameEnded = false;
    gameState.winner = null;

    // Reset all board cells
    document.querySelectorAll('.board-cell').forEach(cell => {
      cell.className = 'board-cell';
      cell.dataset.value = '';
      
      // Reset cell inner elements for the flip card effect
      const cellInner = cell.querySelector('.board-cell-inner');
      if (cellInner) {
        cellInner.style.transform = '';
        const backFace = cellInner.querySelector('.board-cell-back');
        if (backFace) {
          backFace.className = 'board-cell-back';
        }
      }

      // Remove any tactical effects
      const effects = cell.querySelectorAll('.tactical-effect');
      effects.forEach(effect => effect.remove());
      
      // Remove any tactical classes
      cell.classList.remove('tactical-flip', 'x-move', 'o-move', 'defended', 'sacrificed', 'winning-cell');
    });

    // Remove any win line
    const winLine = document.querySelector('.win-line');
    if (winLine) winLine.remove();

    // Reset tactical mode if it's active
    if (window.tacticalMode) {
      window.tacticalMode.resetGame();
    }

    // Update Firebase only if we're in a multiplayer game
    if (gameState.roomCode && !gameState.isQuickGame) {
      updateFirebaseGameState();
    }

    // Update the UI
    updateGameStateUI();
  };

  // Handle the end of the game
  const handleGameEnd = (winner) => {
    gameState.gameEnded = true;
    gameState.winner = winner;

    // Update the UI
    updateGameStateUI();

    // Show the appropriate notification
    if (winner === 'draw') {
      showNotification('Game ended in a draw!');
    } else {
      // Add winning effects to cells
      const winningCombination = getWinningCombination();
      if (winningCombination) {
        highlightWinningCells(winningCombination);
        
        // Add a win line for better visual feedback
        const type = getWinningType(winningCombination);
        if (type) {
          addWinLine(type, winningCombination);
        }
      }
      
      // Show winner notification with modern effect
      const winMessage = gameState.isQuickGame ? 
        (winner === 'X' ? 'You win!' : 'Computer wins!') : 
        `Player ${winner} wins!`;
      
      showNotification(winMessage, 'win');
    }

    // Update Firebase only if in multiplayer game
    if (gameState.roomCode && !gameState.isQuickGame) {
      updateFirebaseGameState();
    }
  };

  // Highlight winning cells
  const highlightWinningCells = (combination) => {
    combination.forEach(index => {
      const cell = document.querySelector(`.board-cell[data-index="${index}"]`);
      if (cell) {
        cell.classList.add('winning-cell');
      }
    });
  };

  // Get the winning type (horizontal, vertical, diagonal)
  const getWinningType = (combination) => {
    // Row wins
    if (combination[0] % 3 === 0 && combination[1] === combination[0] + 1 && combination[2] === combination[0] + 2) {
      return { type: 'horizontal', row: Math.floor(combination[0] / 3) };
    }
    // Column wins
    if (combination[0] < 3 && combination[1] === combination[0] + 3 && combination[2] === combination[0] + 6) {
      return { type: 'vertical', column: combination[0] % 3 };
    }
    // Diagonal wins
    if (combination.includes(0) && combination.includes(4) && combination.includes(8)) {
      return { type: 'diagonal-1' };
    }
    if (combination.includes(2) && combination.includes(4) && combination.includes(6)) {
      return { type: 'diagonal-2' };
    }
    return null;
  };

  // Add a win line for better visualization
  const addWinLine = (winType, combination) => {
    const winLine = document.createElement('div');
    winLine.classList.add('win-line');
    
    const boardElement = document.querySelector('.game-board');
    if (!boardElement) return;
    
    if (winType.type === 'horizontal') {
      winLine.classList.add('horizontal');
      winLine.style.top = `${(winType.row * 33.33) + 16.67}%`;
    } else if (winType.type === 'vertical') {
      winLine.classList.add('vertical');
      winLine.style.left = `${(winType.column * 33.33) + 16.67}%`;
    } else if (winType.type === 'diagonal-1') {
      winLine.classList.add('diagonal-1');
    } else if (winType.type === 'diagonal-2') {
      winLine.classList.add('diagonal-2');
    }
    
    boardElement.appendChild(winLine);
  };

  // Get the winning combination that caused the win
  const getWinningCombination = () => {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (
        gameState.board[a] &&
        gameState.board[a] === gameState.board[b] &&
        gameState.board[a] === gameState.board[c]
      ) {
        return pattern;
      }
    }
    
    return null;
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