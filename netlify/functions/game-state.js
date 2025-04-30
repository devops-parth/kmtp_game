// Simple in-memory game state
let gameState = {
    players: [],
    currentRound: 1,
    phase: 'selection',
    tiles: [],
    scores: [],
    lastReset: Date.now()
};

const roles = ['KING', 'MINISTER', 'POLICE', 'THIEF'];

exports.handler = async function(event, context) {
    // Parse the incoming request
    let data = {};
    try {
        if (event.body) {
            data = JSON.parse(event.body);
        }
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid request body' })
        };
    }

    // Automatic reset if no activity for 5 minutes
    if (Date.now() - gameState.lastReset > 300000) {
        resetGameState();
    }

    try {
        switch (data.action) {
            case 'join':
                return handleJoin(data);
            case 'select':
                return handleSelect(data);
            case 'guess':
                return handleGuess(data);
            case 'next-round':
                return handleNextRound();
            case 'force-start':
                return handleForceStart();
            case 'soft-reset':
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        gameState: {
                            ...gameState,
                            currentRound: 1,
                            phase: 'selection',
                            tiles: [],
                            scores: []
                        }
                    })
                };
            case 'reset':
                resetGameState();
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, gameState })
                };
            default:
                return {
                    statusCode: 200,
                    body: JSON.stringify({ gameState })
                };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: error.message,
                stack: error.stack 
            })
        };
    }
};

function resetGameState() {
    gameState = {
        players: [],
        currentRound: 1,
        phase: 'selection',
        tiles: [],
        scores: [],
        lastReset: Date.now()
    };
}


// Update the handleJoin function
function handleJoin(data) {
    // Check if game is already in progress
    if (gameState.players.length > 0 && gameState.players.length < 4 && gameState.currentRound > 1) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Game is already in progress' })
        };
    }
    
    // Check if game is already full
    if (gameState.players.length >= 4) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Game is already full' })
        };
    }
    
    // Check if name is already taken
    if (gameState.players.some(p => p.name === data.playerName)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Name is already taken' })
        };
    }
    
    // Add player
    const playerId = gameState.players.length;
    gameState.players.push({
        id: playerId,
        name: data.playerName,
        score: 0
    });
    
    // If this is the 4th player, initialize the game
    if (gameState.players.length === 4) {
        gameState.currentRound = 1;
        initializeRound();
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ 
            playerId,
            gameState 
        })
    };
}

function handleSelect(data) {
    // Validate player
    if (data.playerId === undefined || data.playerId >= gameState.players.length) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid player' })
        };
    }
    
    // Validate tile
    if (data.tileIndex === undefined || data.tileIndex < 0 || data.tileIndex > 3) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid tile' })
        };
    }
    
    // Check if player has already selected a tile
    const hasSelected = gameState.tiles.some(t => t.selectedBy === data.playerId);
    if (hasSelected) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'You have already selected a tile' })
        };
    }
    
    // Check if tile is already selected
    if (gameState.tiles[data.tileIndex].selectedBy !== null) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Tile already selected' })
        };
    }
    
    // Select the tile
    gameState.tiles[data.tileIndex].selectedBy = data.playerId;
    
    // Check if all tiles are selected
    const allSelected = gameState.tiles.every(t => t.selectedBy !== null);
    if (allSelected) {
        gameState.phase = 'reveal';
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ gameState })
    };
}

function handleGuess(data) {
    // Validate player
    if (data.playerId === undefined || data.playerId >= gameState.players.length) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid player' })
        };
    }
    
    // Check if current player is the police
    const policeTile = gameState.tiles.find(t => t.role === 'POLICE');
    if (policeTile.selectedBy !== data.playerId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Only police can submit guesses' })
        };
    }
    
    // Calculate scores
    const kingTile = gameState.tiles.find(t => t.role === 'KING');
    const ministerTile = gameState.tiles.find(t => t.role === 'MINISTER');
    const thiefTile = gameState.tiles.find(t => t.role === 'THIEF');
    
    // Update scores based on police guess
    if (data.isCorrect) {
        // Police guessed correctly
        gameState.players[policeTile.selectedBy].score += 500;
        gameState.players[ministerTile.selectedBy].score += 800;
        gameState.players[kingTile.selectedBy].score += 1000;
        gameState.players[thiefTile.selectedBy].score += 0;
    } else {
        // Police guessed incorrectly
        gameState.players[policeTile.selectedBy].score += 0;
        gameState.players[ministerTile.selectedBy].score += 800;
        gameState.players[kingTile.selectedBy].score += 1000;
        gameState.players[thiefTile.selectedBy].score += 500;
    }
    
    gameState.phase = 'results';
    
    return {
        statusCode: 200,
        body: JSON.stringify({ gameState })
    };
}

function handleNextRound() {
    gameState.currentRound++;
    
    if (gameState.currentRound <= 10) {
        initializeRound();
    } else {
        gameState.phase = 'game-over';
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ gameState })
    };
}

function initializeRound() {
    // Reset tiles with random roles
    const shuffledRoles = [...roles].sort(() => Math.random() - 0.5);
    gameState.tiles = shuffledRoles.map(role => ({
        role,
        selectedBy: null
    }));
    
    gameState.phase = 'selection';
}


function handleForceStart() {
    if (gameState.players.length < 2) {
      return { error: 'Need at least 2 players to start' };
    }
    
    // Fill remaining spots with bots if needed
    while (gameState.players.length < 4) {
      gameState.players.push({
        id: gameState.players.length,
        name: `Bot-${gameState.players.length + 1}`,
        score: 0,
        isBot: true
      });
    }
    
    gameState.phase = 'selection';
    initializeRound();
    
    return { success: true, gameState };
  }