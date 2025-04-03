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
  };

  // References
  let gameRef = null;
  let movesRef = null;

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
        const readyBtn = document.createElement('button');
        readyBtn.id = 'readyBtn';
        readyBtn.className = 'action-btn';
        readyBtn.disabled = true;
        readyBtn.innerHTML = 'Start Game';
        readyBtn.addEventListener('click', markPlayerReady);
        document.querySelector('.action-buttons').appendChild(readyBtn);
        
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
    
    // Update ready state in Firebase
    const readyUpdate = {};
    readyUpdate[`readyState/${playerType}`] = true;
    
    gameRef.update(readyUpdate)
      .then(() => {
        showNotification('You are ready!');
        
        // Disable ready button
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
          readyBtn.disabled = true;
          readyBtn.textContent = 'Ready!';
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
        const newPlayers = {
          X: creatorGetsX ? players.creator : players.joiner,
          O: creatorGetsX ? players.joiner : players.creator
        };
        
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
          
          // Update with joiner info
          const updateData = {
            players: { ...gameData.players, joiner: gameState.playerName }
          };
          
          gameRef.update(updateData)
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
            const readyBtn = document.createElement('button');
            readyBtn.id = 'readyBtn';
            readyBtn.className = 'action-btn';
            readyBtn.innerHTML = 'Ready!';
            readyBtn.addEventListener('click', markPlayerReady);
            document.querySelector('.action-buttons').appendChild(readyBtn);
            
            // Initialize tactical mode if needed
            if (gameData.gameMode === 'tactical' && window.tacticalMode) {
              window.tacticalMode.startTacticalGame();
            }
            
            // Enable the creator's start button
            gameRef.update({ 'readyState/creatorCanStart': true });
            
            showNotification('Joined the game successfully! Press Ready when you are ready to play.');
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
            
            // Update player info - Fix the update method to avoid Firebase path issues
            gameRef.child('players').once('value')
              .then((snapshot) => {
                const currentPlayers = snapshot.val() || {};
                currentPlayers[availableSymbol] = gameState.playerName;
                
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

  // Make a move
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
    
    // Update Firebase
    if (gameRef) {
      gameRef.update({
        board: newBoard,
        currentTurn: gameState.playerSymbol === 'X' ? 'O' : 'X',
        gameEnded: result !== null,
        winner: result
      });
      
      // Record the move
      movesRef.push({
        player: gameState.playerSymbol,
        position: index,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
    }
  };

  // Reset the game
  const resetGame = () => {
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

  // Exit the current room
  const exitRoom = () => {
    if (!gameRef) {
      showNotification('Not currently in a game');
      return;
    }
    
    // Update player status in Firebase
    if (gameState.playerSymbol && gameRef) {
      gameRef.child('players').child(gameState.playerSymbol).remove()
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
            if (window.tacticalMode) {
              cell.classList.remove('shield', 'power-tile', 'bomb-tile', 'swap-tile', 'lock-tile', 'bomb-active');
            }
          });
          
          // Hide game action buttons
          copyRoomBtn.style.display = 'none';
          exitRoomBtn.style.display = 'none';
          newGameBtn.style.display = 'none';
          
          // Reset tactical mode if active
          if (window.tacticalMode) {
            window.tacticalMode.setGameMode('classic');
            document.getElementById('tacticalBadge').style.display = 'none';
            document.getElementById('actionPanel').classList.remove('active');
            document.getElementById('blitzTimer').style.display = 'none';
            document.getElementById('gameStats').style.display = 'none';
            document.getElementById('replayContainer').style.display = 'none';
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

  // Event Listeners
  createGameBtn.addEventListener('click', createGame);
  
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