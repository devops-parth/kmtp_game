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
        // Complete reset
        gameState = {
            players: [],
            currentRound: 1,
            phase: 'selection',
            tiles: [],
            scores: []
        };
    } else {
        // Soft reset - maintain players and scores
        gameState = {
            players: gameState.players || [],
            currentRound: 1,
            phase: 'selection',
            tiles: [],
            scores: gameState.players ? gameState.players.map(p => p.score) : []
        };
        
        // Reattach scores to players
        if (gameState.players.length > 0) {
            gameState.players.forEach((player, index) => {
                player.score = gameState.scores[index] || 0;
            });
        }
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ 
            success: true,
            gameState 
        })
    };
};