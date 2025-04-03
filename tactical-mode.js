/**
 * XO Duel: Tactical Strike Mode
 * Enhances the classic XO game with strategic actions,
 * dynamic win conditions, power tiles, and more.
 */

// Tactical Mode for XO.GAME
const tacticalMode = (function() {
    // DOM Elements
    const actionPanel = document.getElementById('actionPanel');
    const tacticalBadge = document.getElementById('tacticalBadge');
    const gameModeSelector = document.getElementById('gameModeSelector');
    const blitzToggle = document.getElementById('blitzModeToggle');
    const gambitToggle = document.getElementById('gambitModeToggle');
    const blitzTimer = document.getElementById('blitzTimer');
    const timerBar = document.getElementById('timerBar');
    const replayBtn = document.getElementById('replayBtn');
    const gameStats = document.getElementById('gameStats');
    
    // Tactical Mode State
    const state = {
        gameMode: 'classic', // 'classic' or 'tactical'
        currentAction: 'strike', // 'strike', 'defend', or 'sacrifice'
        blitzMode: false,
        gambitMode: false,
        timerDuration: 10, // seconds
        timerInterval: null,
        timeRemaining: 0,
        lastMoves: [],
        playerShields: {
            X: 0,
            O: 0
        },
        playerPower: {
            X: 100,
            O: 100
        },
        sacrificePositions: {
            X: [],
            O: []
        }
    };
    
    // Initialize tactical mode
    const init = () => {
        // Hide tactical UI elements by default
        if (actionPanel) actionPanel.style.display = 'none';
        if (tacticalBadge) tacticalBadge.style.display = 'none';
        if (blitzTimer) blitzTimer.style.display = 'none';
        if (gameStats) gameStats.style.display = 'none';
        if (replayBtn) replayBtn.style.display = 'none';
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('Tactical mode initialized');
    };
    
    // Setup event listeners for tactical mode
    const setupEventListeners = () => {
        // Game mode selection
        if (gameModeSelector) {
            const modeOptions = gameModeSelector.querySelectorAll('.mode-option');
            const modeSlider = gameModeSelector.querySelector('.mode-slider');
            
            modeOptions.forEach(option => {
                option.addEventListener('click', () => {
                    // Update active class
                    modeOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    
                    // Move slider
                    if (modeSlider) {
                        const index = Array.from(modeOptions).indexOf(option);
                        modeSlider.style.transform = `translateX(${index * 100}%)`;
                    }
                    
                    // Update game mode
                    state.gameMode = option.dataset.mode;
                    gameModeSelector.dataset.active = state.gameMode;
                    
                    // Show/hide tactical options
                    toggleTacticalOptions(state.gameMode === 'tactical');
                });
            });
        }
        
        // Blitz mode toggle
        if (blitzToggle) {
            const checkbox = blitzToggle.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    state.blitzMode = checkbox.checked;
                    console.log('Blitz mode:', state.blitzMode);
                });
            }
        }
        
        // Gambit mode toggle
        if (gambitToggle) {
            const checkbox = gambitToggle.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    state.gambitMode = checkbox.checked;
                    console.log('Gambit mode:', state.gambitMode);
                });
            }
        }
        
        // Action panel buttons
        if (actionPanel) {
            const actionButtons = actionPanel.querySelectorAll('.action-btn-tactical');
            actionButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Update selected action
                    actionButtons.forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected');
                    state.currentAction = button.dataset.action;
                    
                    console.log('Selected action:', state.currentAction);
                });
            });
        }
        
        // Replay button
        if (replayBtn) {
            replayBtn.addEventListener('click', replayLastMove);
        }
    };
    
    // Toggle tactical options visibility
    const toggleTacticalOptions = (show) => {
        const tacticalOptions = document.querySelector('.tactical-options');
        if (tacticalOptions) {
            tacticalOptions.style.display = show ? 'flex' : 'none';
        }
    };
    
    // Start tactical game mode
    const startTacticalGame = () => {
        if (state.gameMode !== 'tactical') return;
        
        // Show tactical UI elements
        if (actionPanel) actionPanel.style.display = 'flex';
        if (tacticalBadge) tacticalBadge.style.display = 'inline-block';
        if (gameStats) gameStats.style.display = 'flex';
        
        // Reset tactical state
        state.playerShields = { X: 2, O: 2 };
        state.playerPower = { X: 100, O: 100 };
        state.sacrificePositions = { X: [], O: [] };
        state.lastMoves = [];
        
        // Start blitz timer if enabled
        if (state.blitzMode) {
            startBlitzTimer();
        }
        
        console.log('Tactical game started');
    };
    
    // Start blitz timer
    const startBlitzTimer = () => {
        if (!state.blitzMode || !blitzTimer) return;
        
        // Show timer
        blitzTimer.style.display = 'block';
        
        // Reset timer
        resetTimer();
        
        // Start timer
        startTimer();
    };
    
    // Reset timer
    const resetTimer = () => {
        // Clear any existing interval
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        
        // Reset time remaining
        state.timeRemaining = state.timerDuration;
        
        // Reset timer bar
        if (timerBar) {
            timerBar.style.width = '100%';
        }
    };
    
    // Start timer
    const startTimer = () => {
        if (!state.blitzMode || state.timerInterval) return;
        
        // Calculate time increment (10ms interval for smooth animation)
        const intervalMs = 10;
        const decrementPerInterval = intervalMs / (state.timerDuration * 1000);
        
        let remainingPercentage = 100;
        
        // Start interval
        state.timerInterval = setInterval(() => {
            // Decrement remaining percentage
            remainingPercentage -= decrementPerInterval * 100;
            
            // Update timer bar
            if (timerBar) {
                timerBar.style.width = `${Math.max(0, remainingPercentage)}%`;
                
                // Change color as time runs out
                if (remainingPercentage < 30) {
                    timerBar.style.backgroundColor = '#f44336';
                } else if (remainingPercentage < 60) {
                    timerBar.style.backgroundColor = '#ff9800';
                } else {
                    timerBar.style.backgroundColor = '#4caf50';
                }
            }
            
            // Check if timer has expired
            if (remainingPercentage <= 0) {
                // Time's up
                clearInterval(state.timerInterval);
                state.timerInterval = null;
                
                // Handle time expiration
                handleTimeExpired();
            }
        }, intervalMs);
    };
    
    // Handle time expiration
    const handleTimeExpired = () => {
        console.log('Time expired!');
        
        // Trigger auto-move or turn skip
        const gameState = window.gameState;
        if (gameState) {
            // Skip turn
            gameState.isPlayerTurn = false;
            gameState.currentTurn = gameState.currentTurn === 'X' ? 'O' : 'X';
            
            // Update status message
            const statusMessage = document.getElementById('statusMessage');
            if (statusMessage) {
                statusMessage.textContent = `Time's up! ${gameState.currentTurn}'s turn`;
            }
            
            // Reset timer for next player
            resetTimer();
            startTimer();
        }
    };
    
    // Reset game state for tactical mode
    const resetGame = () => {
        // Reset tactical state
        state.playerShields = { X: 2, O: 2 };
        state.playerPower = { X: 100, O: 100 };
        state.sacrificePositions = { X: [], O: [] };
        state.lastMoves = [];
        
        // Reset timer if blitz mode is active
        if (state.blitzMode) {
            resetTimer();
        }
        
        console.log('Tactical game reset');
    };
    
    // Record move for replay
    const recordMove = (player, index, action, boardState) => {
        state.lastMoves.push({
            player,
            index,
            action,
            boardState: [...boardState], // Clone the board state
            timestamp: Date.now()
        });
        
        // Limit the moves history (keep last 10 moves)
        if (state.lastMoves.length > 10) {
            state.lastMoves.shift();
        }
        
        // Show replay button if moves exist
        if (replayBtn && state.lastMoves.length > 0) {
            replayBtn.style.display = 'flex';
        }
    };
    
    // Replay last move (animation)
    const replayLastMove = () => {
        if (state.lastMoves.length === 0) return;
        
        const lastMove = state.lastMoves[state.lastMoves.length - 1];
        
        // Show animation for the move
        const cell = document.querySelector(`.board-cell[data-index="${lastMove.index}"]`);
        if (cell) {
            // Create animation overlay
            const overlay = document.createElement('div');
            overlay.className = 'replay-overlay';
            
            // Add action icon
            const icon = document.createElement('i');
            switch (lastMove.action) {
                case 'strike':
                    icon.className = 'fas fa-crosshairs';
                    break;
                case 'defend':
                    icon.className = 'fas fa-shield-alt';
                    break;
                case 'sacrifice':
                    icon.className = 'fas fa-exchange-alt';
                    break;
            }
            
            // Add player marker
            const marker = document.createElement('span');
            marker.textContent = lastMove.player;
            marker.className = `player-marker ${lastMove.player.toLowerCase()}`;
            
            // Add elements to overlay
            overlay.appendChild(icon);
            overlay.appendChild(marker);
            
            // Add overlay to cell
            cell.appendChild(overlay);
            
            // Remove overlay after animation completes
            setTimeout(() => {
                if (cell.contains(overlay)) {
                    cell.removeChild(overlay);
                }
            }, 1500);
        }
    };
    
    // Process tactical move
    const processTacticalMove = (player, index, boardState) => {
        const action = state.currentAction;
        
        // Handle different actions
        switch (action) {
            case 'strike':
                // Regular move, just place the symbol
                boardState[index] = player;
                break;
                
            case 'defend':
                // Place a shield if player has shields available
                if (state.playerShields[player] > 0) {
                    // Shield the cell
                    boardState[index] = player + 'S'; // S for Shield
                    
                    // Decrease shield count
                    state.playerShields[player]--;
                    
                    // Update shield display
                    updatePlayerStats();
                } else {
                    // No shields available, fall back to strike
                    boardState[index] = player;
                    console.log('No shields available, using strike instead');
                }
                break;
                
            case 'sacrifice':
                // Sacrifice a position to gain a shield
                if (state.sacrificePositions[player].length > 0) {
                    // Get a position to sacrifice
                    const sacIndex = state.sacrificePositions[player].pop();
                    
                    // Clear that position
                    boardState[sacIndex] = '';
                    
                    // Increase shield count
                    state.playerShields[player]++;
                    
                    // Update shield display
                    updatePlayerStats();
                    
                    // Place at the new position
                    boardState[index] = player;
                } else {
                    // No positions to sacrifice, fall back to strike
                    boardState[index] = player;
                    console.log('No positions to sacrifice, using strike instead');
                }
                break;
        }
        
        // Record the move for replay
        recordMove(player, index, action, boardState);
        
        // Return updated board state
        return boardState;
    };
    
    // Update player stats display
    const updatePlayerStats = () => {
        const xStats = document.getElementById('playerXStats');
        const oStats = document.getElementById('playerOStats');
        
        if (xStats && oStats) {
            // Update X player stats
            const xShields = xStats.querySelector('.shields-count') || document.createElement('div');
            xShields.className = 'shields-count';
            xShields.innerHTML = `<i class="fas fa-shield-alt"></i> ${state.playerShields.X}`;
            
            const xPower = xStats.querySelector('.power-level') || document.createElement('div');
            xPower.className = 'power-level';
            xPower.innerHTML = `<i class="fas fa-bolt"></i> ${state.playerPower.X}%`;
            
            if (!xStats.contains(xShields)) xStats.appendChild(xShields);
            if (!xStats.contains(xPower)) xStats.appendChild(xPower);
            
            // Update O player stats
            const oShields = oStats.querySelector('.shields-count') || document.createElement('div');
            oShields.className = 'shields-count';
            oShields.innerHTML = `<i class="fas fa-shield-alt"></i> ${state.playerShields.O}`;
            
            const oPower = oStats.querySelector('.power-level') || document.createElement('div');
            oPower.className = 'power-level';
            oPower.innerHTML = `<i class="fas fa-bolt"></i> ${state.playerPower.O}%`;
            
            if (!oStats.contains(oShields)) oStats.appendChild(oShields);
            if (!oStats.contains(oPower)) oStats.appendChild(oPower);
        }
    };
    
    // Public API
    return {
        init,
        state,
        startTacticalGame,
        processTacticalMove,
        resetGame,
        startBlitzTimer,
        resetTimer
    };
})();

// Initialize tactical mode when document is ready
document.addEventListener('DOMContentLoaded', () => {
    tacticalMode.init();
    
    // Make tacticalMode available globally
    window.tacticalMode = tacticalMode;
}); 