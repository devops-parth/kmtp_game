let gameState = {
    players: [],
    currentRound: 1,
    phase: 'selection',
    tiles: [],
    scores: []
};

exports.handler = async function(event, context) {
    const data = JSON.parse(event.body || '{}');
    
    if (data.action === 'hard-reset') {
        // Complete reset - clear all players
        gameState = {
            players: [],
            currentRound: 1,
            phase: 'selection',
            tiles: [],
            scores: []
        };
    } else if (data.action === 'soft-reset') {
        // Soft reset - keep players but reset game state
        gameState = {
            players: gameState.players.map(player => ({
                ...player,
                score: 0
            })),
            currentRound: 1,
            phase: 'selection',
            tiles: [],
            scores: []
        };
    } else {
        // Default reset (backwards compatible)
        gameState = {
            players: [],
            currentRound: 1,
            phase: 'selection',
            tiles: [],
            scores: []
        };
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ 
            success: true,
            gameState 
        })
    };
};