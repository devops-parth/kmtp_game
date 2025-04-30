// Game state
let playerId = null;
let playerName = '';
let gameState = null;
let currentSelection = null;
let pollInterval = null;
let isWaitingForPlayers = false;

// DOM Elements
const nameEntryScreen = document.getElementById('name-entry');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const joinButton = document.getElementById('join-game');
const playerCount = document.getElementById('player-count');
const playerNamesList = document.getElementById('player-names');
const waitingText = document.getElementById('waiting-text');
const forceStartBtn = document.getElementById('force-start');
const gameBoard = document.getElementById('game-board');
const tiles = document.querySelectorAll('.tile');
const playerScores = document.querySelectorAll('.player-score');
const roundNumber = document.getElementById('round-number');
const policeGuessDiv = document.getElementById('police-guess');
const guessOptionsDiv = document.querySelector('.guess-options');
const submitGuessButton = document.getElementById('submit-guess');
const gameOverDiv = document.getElementById('game-over');
const winnerNameSpan = document.getElementById('winner-name');
const playAgainButton = document.getElementById('play-again');
const resetButton = document.getElementById('reset-game');
const adminResetBtn = document.getElementById('admin-reset');

// Event Listeners
joinButton.addEventListener('click', joinGame);
playAgainButton.addEventListener('click', () => handlePlayAgain(false));
resetButton.addEventListener('click', () => handleFullReset());
adminResetBtn.addEventListener('click', () => handlePlayAgain(true));
submitGuessButton.addEventListener('click', submitGuess);
forceStartBtn.addEventListener('click', forceStartGame);

tiles.forEach(tile => {
    tile.addEventListener('click', () => selectTile(tile));
});

// Main Game Functions
async function joinGame() {
    const name = playerNameInput.value.trim();
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    playerName = name;
    joinButton.disabled = true;
    
    try {
        const response = await fetch('/.netlify/functions/game-state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'join',
                playerName: name
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            handleJoinError(data.error);
            return;
        }
        
        playerId = data.playerId;
        gameState = data.gameState;
        
        if (gameState.players.length === 4) {
            startGame();
        } else {
            showWaitingScreen();
        }
    } catch (error) {
        handleJoinError(error.message);
    }
}

async function handlePlayAgain(isAdmin) {
    if (isAdmin && gameState.players[0]?.id !== playerId) {
        alert('Only the first player can reset the game for everyone');
        return;
    }
    
    try {
        await fetch('/.netlify/functions/reset-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'soft-reset'
            })
        });
        
        // Refresh game state
        const response = await fetch('/.netlify/functions/game-state');
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        gameState = data.gameState;
        gameOverDiv.classList.add('hidden');
        
        if (gameState.players.length === 4) {
            startGame();
        } else {
            showWaitingScreen();
        }
    } catch (error) {
        console.error('Error restarting game:', error);
        alert('Failed to restart game. Please try again.');
    }
}

async function handleFullReset() {
    if (!confirm('This will completely reset the game for ALL players. Continue?')) {
        return;
    }
    
    try {
        await fetch('/.netlify/functions/reset-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'hard-reset'
            })
        });
        
        resetLocalState();
        resetUI();
    } catch (error) {
        console.error('Error resetting game:', error);
        alert('Failed to reset game. Please try again.');
    }
}


function handleJoinError(error) {
    if (error.includes('full')) {
        if (confirm('Game is full. Would you like to reset it?')) {
            resetGame().then(joinGame);
        }
    } else {
        alert(error || 'Failed to join game. Please try again.');
    }
    joinButton.disabled = false;
}

function showWaitingScreen() {
    nameEntryScreen.classList.remove('active');
    waitingScreen.classList.add('active');
    isWaitingForPlayers = true;
    updateWaitingScreen();
    startPolling();
}

function updateWaitingScreen() {
    playerCount.textContent = gameState.players.length;
    playerNamesList.innerHTML = '';
    
    gameState.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name}${player.id === playerId ? ' (You)' : ''}`;
        playerNamesList.appendChild(li);
    });
    
    const needed = 4 - gameState.players.length;
    waitingText.textContent = needed > 0 
        ? `Waiting for ${needed} more player${needed !== 1 ? 's' : ''}...`
        : 'All players ready! Starting game...';
        
    forceStartBtn.classList.toggle('hidden', gameState.players[0]?.id !== playerId);
}

function startPolling() {
    clearPolling();
    pollInterval = setInterval(pollGameState, 2000);
}

function pollGameState() {
    if (!isWaitingForPlayers) return;
    
    fetch('/.netlify/functions/game-state')
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            gameState = data.gameState;
            updateWaitingScreen();
            
            if (gameState.players.length === 4 && gameState.phase !== 'waiting') {
                clearPolling();
                startGame();
            }
        })
        .catch(error => {
            console.error('Polling error:', error);
        });
}

function startGame() {
    waitingScreen.classList.remove('active');
    gameScreen.classList.add('active');
    isWaitingForPlayers = false;
    updateGameUI();
    startGamePolling();
}

function startGamePolling() {
    clearPolling();
    pollInterval = setInterval(pollGameUpdates, 2000);
}

function pollGameUpdates() {
    fetch('/.netlify/functions/game-state')
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            // Only update if game state has changed
            if (JSON.stringify(gameState) !== JSON.stringify(data.gameState)) {
                gameState = data.gameState;
                updateGameUI();
                
                if (gameState.phase === 'game-over') {
                    clearPolling();
                }
            }
        })
        .catch(error => {
            console.error('Game update error:', error);
        });
}

function updateGameUI() {
    if (!gameState) return;
    
    // Update round number
    roundNumber.textContent = gameState.currentRound;
    
    // Update player scores
    updatePlayerScores();
    
    // Update tiles based on game phase
    updateTilesForPhase();
}

function updatePlayerScores() {
    playerScores.forEach((scoreDiv, index) => {
        if (index < gameState.players.length) {
            const player = gameState.players[index];
            scoreDiv.querySelector('.player-name').textContent = player.name;
            scoreDiv.querySelector('.score').textContent = player.score;
            scoreDiv.classList.remove('hidden');
        } else {
            scoreDiv.classList.add('hidden');
        }
    });
}

function updateTilesForPhase() {
    switch (gameState.phase) {
        case 'selection':
            updateSelectionPhase();
            break;
        case 'reveal':
            updateRevealPhase();
            break;
        case 'results':
            updateResultsPhase();
            break;
        case 'game-over':
            endGame();
            break;
    }
}

function updateSelectionPhase() {
    tiles.forEach((tile, index) => {
        tile.textContent = '';
        tile.classList.remove('selected', 'revealed', 'disabled');
        
        const selectedBy = gameState.tiles[index]?.selectedBy;
        if (selectedBy !== null && selectedBy !== undefined) {
            tile.classList.add('selected');
            tile.textContent = gameState.players[selectedBy]?.name || '';
            tile.classList.add('disabled');
        }
        
        if (gameState.tiles.some(t => t.selectedBy === playerId)) {
            tile.classList.add('disabled');
        }
    });
    
    policeGuessDiv.classList.add('hidden');
}

function updateRevealPhase() {
    tiles.forEach((tile, index) => {
        const tileState = gameState.tiles[index];
        
        if (tileState.role === 'KING' || tileState.role === 'POLICE') {
            tile.textContent = tileState.role;
            tile.classList.add('revealed');
        } else {
            tile.textContent = '???';
        }
        
        tile.classList.add('disabled');
    });
    
    // Only show police guess for the actual police player
    const policeTile = gameState.tiles.find(t => t.role === 'POLICE');
    if (policeTile && policeTile.selectedBy === playerId) {
        showPoliceGuess();
    }
}

function updateResultsPhase() {
    tiles.forEach((tile, index) => {
        tile.textContent = gameState.tiles[index].role;
        tile.classList.add('revealed', 'disabled');
    });
    
    setTimeout(() => {
        // Don't automatically proceed to next round if game is over
        if (gameState.phase === 'game-over') {
            endGame();
        } else {
            nextRound();
        }
    }, 3000);
}

async function selectTile(tile) {
    if (tile.classList.contains('disabled')) return;
    
    const tileIndex = parseInt(tile.dataset.index);
    
    try {
        const response = await fetch('/.netlify/functions/game-state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'select',
                playerId: playerId,
                tileIndex: tileIndex
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        }
        
        gameState = data.gameState;
        updateGameUI();
    } catch (error) {
        console.error('Error selecting tile:', error);
        alert('Failed to select tile. Please try again.');
    }
}

async function submitGuess() {
    if (currentSelection === null) {
        alert('Please select who you think is the thief');
        return;
    }
    
    try {
        const response = await fetch('/.netlify/functions/game-state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'guess',
                playerId: playerId,
                isCorrect: currentSelection
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        }
        
        gameState = data.gameState;
        currentSelection = null;
        updateGameUI();
    } catch (error) {
        console.error('Error submitting guess:', error);
        alert('Failed to submit guess. Please try again.');
    }
}

function showPoliceGuess() {
    policeGuessDiv.classList.remove('hidden');
    guessOptionsDiv.innerHTML = '';
    
    const ministerIndex = gameState.tiles.findIndex(t => t.role === 'MINISTER');
    const thiefIndex = gameState.tiles.findIndex(t => t.role === 'THIEF');
    
    if (ministerIndex === -1 || thiefIndex === -1) return;
    
    const ministerPlayer = gameState.players[gameState.tiles[ministerIndex].selectedBy];
    const thiefPlayer = gameState.players[gameState.tiles[thiefIndex].selectedBy];
    
    if (!ministerPlayer || !thiefPlayer) return;
    
    const options = [
        { name: ministerPlayer.name, isThief: false },
        { name: thiefPlayer.name, isThief: true }
    ].sort(() => Math.random() - 0.5);
    
    options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.classList.add('guess-option');
        optionDiv.textContent = option.name;
        optionDiv.dataset.isThief = option.isThief;
        optionDiv.addEventListener('click', () => {
            document.querySelectorAll('.guess-option').forEach(el => {
                el.style.backgroundColor = '#2196F3';
            });
            optionDiv.style.backgroundColor = '#0b7dda';
            currentSelection = option.isThief;
        });
        guessOptionsDiv.appendChild(optionDiv);
    });
}

async function nextRound() {
    try {
        const response = await fetch('/.netlify/functions/game-state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'next-round'
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        }
        
        gameState = data.gameState;
        
        // Only update UI if we're not in game-over state
        if (gameState.phase !== 'game-over') {
            updateGameUI();
        } else {
            endGame();
        }
    } catch (error) {
        console.error('Error moving to next round:', error);
        alert('Failed to start next round. Please try again.');
    }
}

function endGame() {
    if (!gameState || !gameState.players) return;
    
    let maxScore = -1;
    let winners = [];
    
    gameState.players.forEach(player => {
        if (player.score > maxScore) {
            maxScore = player.score;
            winners = [player.name];
        } else if (player.score === maxScore) {
            winners.push(player.name);
        }
    });
    
    winnerNameSpan.textContent = winners.join(' and ');
    gameOverDiv.classList.remove('hidden');
    
    // Auto-reset after 30 seconds
    setTimeout(() => {
        if (gameOverDiv.classList.contains('hidden')) return;
        handlePlayAgain(true);
    }, 30000);
}

async function resetGame() {
    try {
        isWaitingForPlayers = false;
        clearPolling();
        
        await fetch('/.netlify/functions/reset-game', {
            method: 'POST'
        });
        
        resetLocalState();
        resetUI();
    } catch (error) {
        console.error('Error resetting game:', error);
        alert('Failed to reset game. Please try again.');
    }
}

function resetLocalState() {
    playerId = null;
    playerName = '';
    gameState = null;
    currentSelection = null;
}

function resetUI() {
    gameScreen.classList.remove('active');
    gameOverDiv.classList.add('hidden');
    policeGuessDiv.classList.add('hidden');
    nameEntryScreen.classList.add('active');
    waitingScreen.classList.remove('active');
    playerNameInput.value = '';
    playerNameInput.focus();
}

async function forceStartGame() {
    try {
        const response = await fetch('/.netlify/functions/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'force-start' })
        });
        
        const data = await response.json();
        if (data.success) startGame();
    } catch (error) {
        console.error('Force start failed:', error);
    }
}

function clearPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// Initialize
async function init() {
    try {
        const response = await fetch('/.netlify/functions/game-state');
        const data = await response.json();
        
        if (!data.error && data.gameState) {
            gameState = data.gameState;
            
            const player = gameState.players.find(p => p.name === playerName);
            if (player) {
                playerId = player.id;
                if (gameState.players.length === 4 && gameState.phase !== 'waiting') {
                    startGame();
                } else {
                    showWaitingScreen();
                }
            }
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Start initialization
init();