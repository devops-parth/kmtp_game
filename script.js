// Game state
let playerId = null;
let playerName = '';
let gameState = null;
let currentSelection = null;
let pollInterval = null;

// DOM Elements
const nameEntryScreen = document.getElementById('name-entry');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const joinButton = document.getElementById('join-game');
const waitingMessage = document.getElementById('waiting-message');
const currentPlayersDiv = document.getElementById('current-players');
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

// Event Listeners
joinButton.addEventListener('click', joinGame);
playAgainButton.addEventListener('click', resetGame);
resetButton.addEventListener('click', resetGame);
submitGuessButton.addEventListener('click', submitGuess);

tiles.forEach(tile => {
    tile.addEventListener('click', () => selectTile(tile));
});

// Functions
async function joinGame() {
    const name = playerNameInput.value.trim();
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    playerName = name;
    
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
            alert(data.error);
            return;
        }
        
        playerId = data.playerId;
        gameState = data.gameState;
        
        updateWaitingScreen();
        
        if (gameState.players.length === 4) {
            startGame();
        } else {
            // Poll for game updates
            pollInterval = setInterval(pollGameState, 2000);
        }
    } catch (error) {
        console.error('Error joining game:', error);
        alert('Failed to join game. Please try again.');
    }
}

function updateWaitingScreen() {
    nameEntryScreen.classList.remove('active');
    waitingMessage.classList.remove('hidden');
    
    currentPlayersDiv.innerHTML = '';
    gameState.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.textContent = player.name;
        currentPlayersDiv.appendChild(playerDiv);
    });
}

async function pollGameState() {
    try {
        const response = await fetch('/.netlify/functions/game-state');
        const data = await response.json();
        
        if (data.error) {
            console.error(data.error);
            return;
        }
        
        gameState = data.gameState;
        
        // Update waiting screen
        currentPlayersDiv.innerHTML = '';
        gameState.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.textContent = player.name;
            currentPlayersDiv.appendChild(playerDiv);
        });
        
        // Check if game can start
        if (gameState.players.length === 4) {
            clearInterval(pollInterval);
            startGame();
        }
    } catch (error) {
        console.error('Error polling game state:', error);
    }
}

function startGame() {
    nameEntryScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    updateGameUI();
}

function updateGameUI() {
    // Update round number
    roundNumber.textContent = gameState.currentRound;
    
    // Update player scores
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
    
    // Update tiles
    if (gameState.phase === 'selection') {
        tiles.forEach((tile, index) => {
            tile.textContent = '';
            tile.classList.remove('selected', 'revealed', 'disabled');
            
            // Check if this tile is already selected by someone
            const selectedBy = gameState.tiles[index].selectedBy;
            if (selectedBy !== null) {
                tile.classList.add('selected');
                tile.textContent = gameState.players[selectedBy].name;
                tile.classList.add('disabled');
            }
            
            // Check if current player has already selected a tile
            if (gameState.tiles.some(t => t.selectedBy === playerId)) {
                tile.classList.add('disabled');
            }
        });
        
        policeGuessDiv.classList.add('hidden');
    } else if (gameState.phase === 'reveal') {
        tiles.forEach((tile, index) => {
            const tileState = gameState.tiles[index];
            
            // Reveal KING and POLICE tiles
            if (tileState.role === 'KING' || tileState.role === 'POLICE') {
                tile.textContent = tileState.role;
                tile.classList.add('revealed');
            } else {
                tile.textContent = '???';
            }
            
            tile.classList.add('disabled');
        });
        
        // Show police guess if current player is police
        const policePlayerIndex = gameState.tiles.findIndex(t => t.role === 'POLICE' && t.selectedBy === playerId);
        if (policePlayerIndex !== -1) {
            showPoliceGuess();
        }
    } else if (gameState.phase === 'results') {
        // Show all roles
        tiles.forEach((tile, index) => {
            tile.textContent = gameState.tiles[index].role;
            tile.classList.add('revealed', 'disabled');
        });
        
        // Show results for a few seconds before next round
        setTimeout(async () => {
            if (gameState.currentRound > 10) {
                endGame();
            } else {
                await nextRound();
            }
        }, 3000);
    }
}

function showPoliceGuess() {
    policeGuessDiv.classList.remove('hidden');
    guessOptionsDiv.innerHTML = '';
    
    // Get the indices of MINISTER and THIEF tiles
    const ministerIndex = gameState.tiles.findIndex(t => t.role === 'MINISTER');
    const thiefIndex = gameState.tiles.findIndex(t => t.role === 'THIEF');
    
    // Get the players who selected these tiles
    const ministerPlayer = gameState.players[gameState.tiles[ministerIndex].selectedBy];
    const thiefPlayer = gameState.players[gameState.tiles[thiefIndex].selectedBy];
    
    // Create guess options (random order)
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
        updateGameUI();
    } catch (error) {
        console.error('Error moving to next round:', error);
        alert('Failed to start next round. Please try again.');
    }
}

function endGame() {
    // Determine winner
    let maxScore = -1;
    let winner = '';
    
    gameState.players.forEach(player => {
        if (player.score > maxScore) {
            maxScore = player.score;
            winner = player.name;
        }
    });
    
    winnerNameSpan.textContent = winner;
    gameOverDiv.classList.remove('hidden');
}

async function resetGame() {
    try {
        // Call reset function
        await fetch('/.netlify/functions/reset-game', {
            method: 'POST'
        });
        
        // Reset local state
        playerId = null;
        playerName = '';
        gameState = null;
        currentSelection = null;
        
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        
        // Reset UI
        gameScreen.classList.remove('active');
        gameOverDiv.classList.add('hidden');
        policeGuessDiv.classList.add('hidden');
        nameEntryScreen.classList.add('active');
        playerNameInput.value = '';
        waitingMessage.classList.add('hidden');
    } catch (error) {
        console.error('Error resetting game:', error);
        alert('Failed to reset game. Please try again.');
    }
}