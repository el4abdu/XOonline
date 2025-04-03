/**
 * XO Duel: Tactical Strike Mode
 * Enhances the classic XO game with strategic actions,
 * dynamic win conditions, power tiles, and more.
 */

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  
  // DOM Elements
  const gameModeSelector = document.getElementById('gameModeSelector');
  const modeOptions = document.querySelectorAll('.mode-option');
  const tacticalBadge = document.getElementById('tacticalBadge');
  const actionPanel = document.getElementById('actionPanel');
  const actionButtons = document.querySelectorAll('.action-btn-tactical');
  const blitzModeToggle = document.getElementById('blitzModeToggle');
  const blitzModeCheckbox = document.getElementById('blitzModeCheckbox');
  const blitzTimer = document.getElementById('blitzTimer');
  const timerBar = document.getElementById('timerBar');
  const gambitModeToggle = document.getElementById('gambitModeToggle');
  const gambitModeCheckbox = document.getElementById('gambitModeCheckbox');
  const gambitSetup = document.getElementById('gambitSetup');
  const gameStats = document.getElementById('gameStats');
  const replayContainer = document.getElementById('replayContainer');
  const replayBtn = document.getElementById('replayBtn');
  const rematchBtn = document.getElementById('rematchBtn');
  const boardCells = document.querySelectorAll('.board-cell');
  const playerXScore = document.getElementById('playerXScore');
  const playerOScore = document.getElementById('playerOScore');
  
  // Game state extension for tactical mode
  const tacticalState = {
    gameMode: 'classic', // 'classic' or 'tactical'
    isBlitzMode: false,
    isGambitMode: false,
    currentAction: 'strike', // 'strike', 'defend', or 'sacrifice'
    sacrificeMade: false,
    shieldCount: 0,
    diagonalWinsX: 0,
    diagonalWinsO: 0,
    powerTiles: [],
    bombs: {},
    lastMove: null,
    playerXScore: 0,
    playerOScore: 0,
    playerCoins: 1000,
    opponentCoins: 1000,
    betAmount: 100,
    timerInterval: null,
    timeLeft: 10,
    canPlaceShields: 0, // Number of shields player can place after sacrifice
    boardState: Array(9).fill(null) // Separate from gameState.board for tactical-specific states
  };
  
  // Initialize tactical mode
  const initTacticalMode = () => {
    // Set up event listeners for game mode selector
    modeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const mode = option.getAttribute('data-mode');
        setGameMode(mode);
      });
    });
    
    // Set up event listeners for action buttons
    actionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action');
        setCurrentAction(action);
      });
    });
    
    // Blitz mode toggle
    blitzModeCheckbox.addEventListener('change', () => {
      tacticalState.isBlitzMode = blitzModeCheckbox.checked;
      if (tacticalState.isBlitzMode) {
        blitzTimer.style.display = 'block';
        gameStats.style.display = 'flex';
      } else {
        blitzTimer.style.display = 'none';
        gameStats.style.display = 'none';
      }
    });
    
    // Gambit mode toggle
    gambitModeCheckbox.addEventListener('change', () => {
      tacticalState.isGambitMode = gambitModeCheckbox.checked;
    });
    
    // Bet amount controls
    document.getElementById('decreaseBet').addEventListener('click', () => {
      const betInput = document.getElementById('betAmount');
      let currentBet = parseInt(betInput.value);
      currentBet = Math.max(50, currentBet - 50);
      betInput.value = currentBet;
      tacticalState.betAmount = currentBet;
    });
    
    document.getElementById('increaseBet').addEventListener('click', () => {
      const betInput = document.getElementById('betAmount');
      let currentBet = parseInt(betInput.value);
      currentBet = Math.min(1000, currentBet + 50);
      betInput.value = currentBet;
      tacticalState.betAmount = currentBet;
    });
    
    document.getElementById('betAmount').addEventListener('change', (e) => {
      tacticalState.betAmount = parseInt(e.target.value);
    });
    
    document.getElementById('confirmBet').addEventListener('click', confirmBet);
    
    // Replay button
    replayBtn.addEventListener('click', replayLastMove);
    
    // Rematch button
    rematchBtn.addEventListener('click', requestRematch);
  };
  
  // Set the game mode (classic or tactical)
  const setGameMode = (mode) => {
    tacticalState.gameMode = mode;
    
    // Update UI
    gameModeSelector.setAttribute('data-active', mode);
    modeOptions.forEach(option => {
      if (option.getAttribute('data-mode') === mode) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
    
    // Show/hide tactical elements
    if (mode === 'tactical') {
      tacticalBadge.style.display = 'inline-flex';
      blitzModeToggle.style.display = 'flex';
      gambitModeToggle.style.display = 'flex';
    } else {
      tacticalBadge.style.display = 'none';
      blitzModeToggle.style.display = 'none';
      gambitModeToggle.style.display = 'none';
      blitzModeCheckbox.checked = false;
      gambitModeCheckbox.checked = false;
      tacticalState.isBlitzMode = false;
      tacticalState.isGambitMode = false;
      blitzTimer.style.display = 'none';
      gameStats.style.display = 'none';
    }
  };
  
  // Set the current action in tactical mode
  const setCurrentAction = (action) => {
    // Check if this action is valid given the current state
    if (action === 'sacrifice' && tacticalState.sacrificeMade) {
      showNotification('You have already made a sacrifice this game!');
      return;
    }
    
    if (action === 'defend' && tacticalState.canPlaceShields <= 0 && tacticalState.currentAction !== 'sacrifice') {
      showNotification('Use sacrifice first to gain shields!');
      return;
    }
    
    tacticalState.currentAction = action;
    
    // Update UI
    actionButtons.forEach(button => {
      if (button.getAttribute('data-action') === action) {
        button.classList.add('selected');
      } else {
        button.classList.remove('selected');
      }
    });
    
    updateStatusMessage();
  };
  
  // Make a move in tactical mode
  const makeTacticalMove = (index) => {
    // Get the current player symbol from the main game state
    const symbol = window.gameState.playerSymbol;
    
    // Get the cell element
    const cell = boardCells[index];
    
    if (tacticalState.boardState[index]) {
      showNotification('This cell is already occupied!');
      return false;
    }
    
    // Execute different actions based on the current action
    switch (tacticalState.currentAction) {
      case 'strike':
        return placeSymbol(index, symbol);
      case 'defend':
        return placeShield(index);
      case 'sacrifice':
        return makeSacrifice(index, symbol);
      default:
        return false;
    }
  };
  
  // Place a symbol on the board (Strike action)
  const placeSymbol = (index, symbol) => {
    const cell = boardCells[index];
    
    // Check if the cell has a shield or power tile
    if (cell.classList.contains('shield')) {
      showNotification('This cell is protected by a shield!');
      return false;
    }
    
    if (cell.classList.contains('lock-tile')) {
      showNotification('This cell is locked!');
      return false;
    }
    
    // Place the symbol
    tacticalState.boardState[index] = symbol;
    
    // Add class for visual
    cell.classList.add(symbol === 'X' ? 'x-move' : 'o-move');
    
    // Save the last move for replay
    tacticalState.lastMove = {
      index,
      action: 'strike',
      symbol
    };
    
    // Handle bomb tiles
    if (cell.classList.contains('bomb-tile')) {
      activateBomb(index);
    }
    
    // Handle swap tiles
    if (cell.classList.contains('swap-tile')) {
      activateSwap(index, symbol);
    }
    
    // Check for win after the move
    checkTacticalWin();
    
    // Move successful
    return true;
  };
  
  // Place a shield on the board (Defend action)
  const placeShield = (index) => {
    if (tacticalState.canPlaceShields <= 0) {
      showNotification('You have no shields to place!');
      return false;
    }
    
    const cell = boardCells[index];
    
    // Check if cell is empty
    if (tacticalState.boardState[index] || cell.classList.contains('shield')) {
      showNotification('Cannot place shield here!');
      return false;
    }
    
    // Place the shield
    tacticalState.boardState[index] = 'shield';
    tacticalState.canPlaceShields--;
    
    // Add class for visual
    cell.classList.add('shield');
    
    // Play animation
    cell.style.animation = 'defend-animation var(--move-animation-duration)';
    setTimeout(() => {
      cell.style.animation = '';
    }, 400);
    
    // Save the last move for replay
    tacticalState.lastMove = {
      index,
      action: 'defend'
    };
    
    // Update UI
    updateStatusMessage();
    
    // If this was the last shield to place, reset to strike action
    if (tacticalState.canPlaceShields === 0) {
      setCurrentAction('strike');
    }
    
    return true;
  };
  
  // Make a sacrifice (Sacrifice action)
  const makeSacrifice = (index, symbol) => {
    const cell = boardCells[index];
    
    // Can only sacrifice your own symbol
    if (tacticalState.boardState[index] !== symbol) {
      showNotification('You can only sacrifice your own symbol!');
      return false;
    }
    
    // Execute the sacrifice
    tacticalState.boardState[index] = null;
    cell.classList.remove('x-move', 'o-move');
    
    // Grant 2 shields to place
    tacticalState.canPlaceShields = 2;
    tacticalState.sacrificeMade = true;
    
    // Save the last move for replay
    tacticalState.lastMove = {
      index,
      action: 'sacrifice',
      symbol
    };
    
    // Switch to defend action automatically
    setCurrentAction('defend');
    
    showNotification('Sacrifice made! Place 2 shields.');
    return true;
  };
  
  // Activate a bomb tile
  const activateBomb = (index) => {
    const cell = boardCells[index];
    cell.classList.add('bomb-active');
    
    // Bomb will explode after 3 turns
    tacticalState.bombs[index] = 3;
    
    showNotification('Bomb activated! Will explode in 3 turns.');
  };
  
  // Activate a swap tile
  const activateSwap = (index, symbol) => {
    showNotification('Swap tile activated! Choose an opponent\'s symbol to swap with.');
    
    // Here we would implement a selection mode for the player to choose
    // which opponent symbol to swap with. For simplicity, we'll just
    // choose the first opponent symbol found
    
    const oppositeSymbol = symbol === 'X' ? 'O' : 'X';
    
    let oppositeIndex = -1;
    tacticalState.boardState.forEach((cellValue, idx) => {
      if (cellValue === oppositeSymbol && oppositeIndex === -1) {
        oppositeIndex = idx;
      }
    });
    
    if (oppositeIndex !== -1) {
      // Swap the symbols
      tacticalState.boardState[oppositeIndex] = symbol;
      tacticalState.boardState[index] = oppositeSymbol;
      
      // Update visuals
      boardCells[oppositeIndex].classList.remove('o-move', 'x-move');
      boardCells[oppositeIndex].classList.add(symbol === 'X' ? 'x-move' : 'o-move');
      
      boardCells[index].classList.remove('o-move', 'x-move');
      boardCells[index].classList.add(oppositeSymbol === 'X' ? 'x-move' : 'o-move');
      
      showNotification('Symbols swapped!');
    }
  };
  
  // Check for win in tactical mode
  const checkTacticalWin = () => {
    if (tacticalState.gameMode !== 'tactical') {
      return null; // Use regular win checking from main game
    }
    
    // Win patterns
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];
    
    // In tactical mode, diagonal wins are special
    const diagonalPatterns = [[0, 4, 8], [2, 4, 6]];
    
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (
        tacticalState.boardState[a] &&
        tacticalState.boardState[a] !== 'shield' &&
        tacticalState.boardState[a] === tacticalState.boardState[b] &&
        tacticalState.boardState[a] === tacticalState.boardState[c]
      ) {
        const winningSymbol = tacticalState.boardState[a];
        
        // Check if this is a diagonal win
        const isDiagonal = diagonalPatterns.some(diag => 
          JSON.stringify(diag) === JSON.stringify(pattern)
        );
        
        if (isDiagonal) {
          // Handle diagonal win in tactical mode
          if (winningSymbol === 'X') {
            tacticalState.diagonalWinsX++;
            showNotification('Player X scored a diagonal win!');
          } else {
            tacticalState.diagonalWinsO++;
            showNotification('Player O scored a diagonal win!');
          }
          
          // Add win indicator visually
          const boardContainer = document.querySelector('.board-container');
          const indicator = document.createElement('div');
          indicator.className = `diagonal-win-indicator ${pattern[0] === 2 ? 'secondary' : ''}`;
          boardContainer.appendChild(indicator);
          
          // Check if player has 2 diagonal wins for tactical win
          if (tacticalState.diagonalWinsX >= 2) {
            endTacticalGame('X');
            return 'X';
          }
          
          if (tacticalState.diagonalWinsO >= 2) {
            endTacticalGame('O');
            return 'O';
          }
          
          // Reset the board for next round, but keep diagonal win count
          setTimeout(() => {
            resetBoardOnly();
          }, 1500);
          
          return null; // Game continues, no overall winner yet
        }
        
        // Regular win in any pattern
        endTacticalGame(winningSymbol);
        return winningSymbol;
      }
    }
    
    // Check for a draw - board is full
    if (!tacticalState.boardState.some(cell => cell === null || cell === undefined)) {
      endTacticalGame('Draw');
      return 'Draw';
    }
    
    // No win yet
    return null;
  };
  
  // End the tactical game
  const endTacticalGame = (result) => {
    if (result === 'X') {
      tacticalState.playerXScore++;
      playerXScore.textContent = tacticalState.playerXScore;
      showNotification('Player X wins the game!');
    } else if (result === 'O') {
      tacticalState.playerOScore++;
      playerOScore.textContent = tacticalState.playerOScore;
      showNotification('Player O wins the game!');
    } else {
      showNotification('Game ended in a draw!');
    }
    
    // Handle Blitz mode score tracking for best-of-5
    if (tacticalState.isBlitzMode) {
      if (tacticalState.playerXScore >= 3) {
        showNotification('Player X wins the match!');
        // Handle rewards, etc.
      } else if (tacticalState.playerOScore >= 3) {
        showNotification('Player O wins the match!');
        // Handle rewards, etc.
      } else {
        // Continue the match with a new game
        setTimeout(() => {
          resetBoardOnly();
        }, 2000);
      }
    }
    
    // Show replay and rematch options
    replayContainer.style.display = 'block';
    
    // In a real implementation, we would update Firebase with the results
  };
  
  // Reset the board for a new game but keep scores
  const resetBoardOnly = () => {
    // Clear board state
    tacticalState.boardState = Array(9).fill(null);
    tacticalState.canPlaceShields = 0;
    tacticalState.sacrificeMade = false; // Allow sacrifice in new game
    tacticalState.bombs = {};
    
    // Reset the board visuals
    boardCells.forEach(cell => {
      cell.classList.remove('x-move', 'o-move', 'shield', 'bomb-active');
    });
    
    // Remove win indicators
    const indicators = document.querySelectorAll('.diagonal-win-indicator');
    indicators.forEach(indicator => indicator.remove());
    
    // Reset action to strike
    setCurrentAction('strike');
    
    // Generate new power tiles for the next game
    setupPowerTiles();
    
    // Update status message
    updateStatusMessage();
  };
  
  // Complete reset including scores
  const resetGame = () => {
    resetBoardOnly();
    
    // Reset scores
    tacticalState.playerXScore = 0;
    tacticalState.playerOScore = 0;
    tacticalState.diagonalWinsX = 0;
    tacticalState.diagonalWinsO = 0;
    
    // Update UI
    playerXScore.textContent = '0';
    playerOScore.textContent = '0';
    
    // Hide replay container
    replayContainer.style.display = 'none';
  };
  
  // Function to confirm bet in Gambit mode
  const confirmBet = () => {
    if (tacticalState.betAmount > tacticalState.playerCoins) {
      showNotification('You don\'t have enough coins for this bet!');
      return;
    }
    
    gambitSetup.style.display = 'none';
    showNotification(`Bet placed: ${tacticalState.betAmount} coins`);
    
    // Here you would update the Firebase database with the bet information
    // and wait for the opponent to confirm their bet
  };
  
  // Replay the last move
  const replayLastMove = () => {
    if (!tacticalState.lastMove) return;
    
    // Replay animation logic would go here
    showNotification('Replaying last move...');
    
    // Simple implementation: highlight the last move cell
    const cell = document.querySelector(`.board-cell[data-index="${tacticalState.lastMove.index}"]`);
    if (cell) {
      cell.classList.add('highlight');
      setTimeout(() => {
        cell.classList.remove('highlight');
      }, 1000);
    }
  };
  
  // Request a rematch
  const requestRematch = () => {
    showNotification('Requesting rematch...');
    
    // Firebase implementation would go here
    // For now, we'll just reset the game locally
    resetGame();
  };

  // Setup power tiles randomly on the board
  const setupPowerTiles = () => {
    // Clear existing power tiles
    boardCells.forEach(cell => {
      cell.classList.remove('power-tile', 'bomb-tile', 'swap-tile', 'lock-tile');
    });
    
    // Don't add power tiles in classic mode
    if (tacticalState.gameMode !== 'tactical') return;
    
    // Generate 3 unique random positions for power tiles
    const positions = [];
    while (positions.length < 3) {
      const pos = Math.floor(Math.random() * 9);
      if (!positions.includes(pos)) {
        positions.push(pos);
      }
    }
    
    // Assign different power types to the positions
    boardCells[positions[0]].classList.add('power-tile', 'bomb-tile');
    boardCells[positions[1]].classList.add('power-tile', 'swap-tile');
    boardCells[positions[2]].classList.add('power-tile', 'lock-tile');
    
    tacticalState.powerTiles = positions;
  };
  
  // Update the status message based on current game state
  const updateStatusMessage = () => {
    const statusMessage = document.getElementById('statusMessage');
    
    if (!statusMessage) return;
    
    if (tacticalState.gameMode === 'tactical') {
      let message = '';
      
      if (tacticalState.currentAction === 'strike') {
        message = 'Place your symbol on the board';
      } else if (tacticalState.currentAction === 'defend') {
        message = `Place a shield (${tacticalState.canPlaceShields} remaining)`;
      } else if (tacticalState.currentAction === 'sacrifice') {
        message = 'Select one of your symbols to sacrifice';
      }
      
      statusMessage.textContent = message;
    }
  };
  
  // Start the blitz timer
  const startBlitzTimer = () => {
    // Clear any existing interval
    if (tacticalState.timerInterval) {
      clearInterval(tacticalState.timerInterval);
    }
    
    tacticalState.timeLeft = 10;
    timerBar.style.width = '100%';
    
    tacticalState.timerInterval = setInterval(() => {
      tacticalState.timeLeft -= 0.1;
      const percentage = (tacticalState.timeLeft / 10) * 100;
      timerBar.style.width = `${percentage}%`;
      
      if (tacticalState.timeLeft <= 0) {
        clearInterval(tacticalState.timerInterval);
        handleTimeOut();
      }
    }, 100);
  };
  
  // Handle timeout in blitz mode
  const handleTimeOut = () => {
    showNotification('Time\'s up! Random move made.');
    
    // Make a random move
    const emptyCells = [];
    tacticalState.boardState.forEach((cell, index) => {
      if (!cell) emptyCells.push(index);
    });
    
    if (emptyCells.length > 0) {
      const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      // Make a move - in a real implementation this would trigger the regular move flow
      placeSymbol(randomIndex, window.gameState.playerSymbol);
    }
  };

  // Initialize the tactical mode
  initTacticalMode();
  
  // Function to be called when starting a new game
  const startTacticalGame = () => {
    // Reset the board
    resetGame();
    
    // Set up power tiles in tactical mode
    setupPowerTiles();
    
    // Show action panel if in tactical mode
    if (tacticalState.gameMode === 'tactical') {
      actionPanel.classList.add('active');
    }
    
    // Start blitz timer if in blitz mode
    if (tacticalState.isBlitzMode) {
      startBlitzTimer();
    }
    
    // Show gambit setup if in gambit mode
    if (tacticalState.isGambitMode) {
      gambitSetup.style.display = 'block';
    }
  };
  
  // Call the init function to set everything up
  initTacticalMode();
  
  // Exposing functions to the global scope to be used by app.js
  window.tacticalMode = {
    state: tacticalState,
    setGameMode,
    setCurrentAction,
    makeTacticalMove,
    startTacticalGame,
    resetGame,
    showNotification: (message) => window.showNotification(message),
  };
}); 