let gameState = {
    players: [],
    currentRound: 1,
    phase: 'selection',
    tiles: [],
    scores: []
};

exports.handler = async function(event, context) {
    // Reset the game state
    gameState = {
        players: [],
        currentRound: 1,
        phase: 'selection',
        tiles: [],
        scores: []
    };
    
    return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
    };
};
