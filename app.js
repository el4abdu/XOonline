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
    
    // Randomize player symbol (X or O) and first turn
    const randomSymbols = Math.random() < 0.5;
    const creatorSymbol = randomSymbols ? 'O' : 'X';
    const firstTurn = Math.random() < 0.5 ? 'X' : 'O';
    
    gameState.roomCode = roomCode;
    gameState.playerSymbol = creatorSymbol;
    gameState.isPlayerTurn = firstTurn === creatorSymbol;
    gameState.gameActive = true;
    gameState.board = Array(9).fill('');
    gameState.currentTurn = firstTurn;
    gameState.gameEnded = false;
    gameState.winner = null;

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
            currentTurn: firstTurn,
            randomSymbols: randomSymbols,
            players: {}
          };
          
          // Set the creator in the correct field based on their symbol
          gameData.players[creatorSymbol] = gameState.playerName;
          
          gameData.board = gameState.board;
          gameData.gameEnded = false;
          gameData.winner = null;
          
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
        playerSymbol.textContent = creatorSymbol;
        
        if (gameState.isPlayerTurn) {
            updateStatusMessage("Your turn");
        } else {
            updateStatusMessage(`Waiting for player ${creatorSymbol === 'X' ? 'O' : 'X'} to join...`);
        }
        
        // Show buttons
        copyRoomBtn.style.display = 'flex';
        exitRoomBtn.style.display = 'flex';
        newGameBtn.style.display = 'none';
        
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
          // Determine the joiner's symbol based on creator's symbol
          const creatorHasX = gameData.players && gameData.players.X;
          const joinerSymbol = creatorHasX ? 'O' : 'X';
          
          gameState.roomCode = roomCode;
          gameState.playerSymbol = joinerSymbol;
          gameState.isPlayerTurn = gameData.currentTurn === joinerSymbol;
          gameState.board = gameData.board || Array(9).fill('');
          gameState.currentTurn = gameData.currentTurn || 'X';
          gameState.gameEnded = gameData.gameEnded || false;
          gameState.winner = gameData.winner || null;
          gameState.gameActive = true;
          
          // Update game in Firebase
          gameRef = database.ref(`games/${roomCode}`);
          movesRef = gameRef.child('moves');
          
          // Create the update object with appropriate player field
          const updateData = {
            status: 'active'
          };
          updateData[`players.${joinerSymbol}`] = gameState.playerName;
          
          gameRef.update(updateData)
          .then(() => {
            console.log('Successfully updated game status to active');
            
            // Listen for changes
            setupGameListeners();
            
            // Update UI
            gameSetup.classList.remove('active');
            gameBoard.classList.add('active');
            roomCodeDisplay.textContent = roomCode;
            playerSymbol.textContent = joinerSymbol;
            
            if (gameState.isPlayerTurn) {
              updateStatusMessage("Your turn");
            } else {
              updateStatusMessage(`${gameState.currentTurn}'s turn`);
            }
            
            // Show action buttons
            copyRoomBtn.style.display = 'flex';
            exitRoomBtn.style.display = 'flex';
            newGameBtn.style.display = 'flex';
            
            // Initialize tactical mode if needed
            if (gameData.gameMode === 'tactical' && window.tacticalMode) {
              window.tacticalMode.startTacticalGame();
            }
            
            showNotification('Joined the game successfully!');
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
            
            // Update player info
            const playerUpdate = {};
            playerUpdate[availableSymbol] = gameState.playerName;
            
            gameRef.child('players').update(playerUpdate)
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
      gameState.isPlayerTurn = gameState.currentTurn === gameState.playerSymbol;
      
      // Update UI based on current game state
      renderBoard();
      
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
          updateStatusMessage("Waiting for player O to join...");
        } else {
          if (gameState.isPlayerTurn) {
            updateStatusMessage("Your turn");
          } else {
            updateStatusMessage(`${gameState.currentTurn}'s turn`);
          }
        }
      }
    });
    
    // Listen for player disconnect to handle reconnects
    gameRef.child('players').on('value', (snapshot) => {
      const players = snapshot.val() || {};
      
      // If the other player disconnected, update the status
      if (gameState.playerSymbol === 'X' && !players.O) {
        updateStatusMessage("Waiting for player O to join...");
      } else if (gameState.playerSymbol === 'O' && !players.X) {
        updateStatusMessage("Waiting for player X to join...");
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
            playerName: gameState.playerName
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