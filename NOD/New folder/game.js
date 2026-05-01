/**
 * ========================================
 * CARD BATTLE - GAME LOGIC
 * NOD - Game Based Learning System
 * ========================================
 */

// ========================================
// GAME STATE
// ========================================
const GameState = {
    gameId: null,
    isActive: false,
    currentPlayer: 1, // 1 or 2
    round: 1,
    cardIdCounter: 0, // Unique ID counter for cards
    
    players: {
        1: {
            name: 'Player 1',
            uid: null, // Firebase Auth UID
            cards: [], // Array of {id, value} objects
            playedCard: null, // The card object that was played
            lastPlayedCardId: null, // Card ID on cooldown
            score: 0
        },
        2: {
            name: 'Player 2',
            uid: null, // Firebase Auth UID
            cards: [],
            playedCard: null,
            lastPlayedCardId: null,
            score: 0
        }
    },
    
    timer: {
        totalSeconds: 600, // 10 minutes default
        remaining: 600,
        interval: null
    },
    
    settings: {
        cardCount: 5,
        transitionTime: 3, // seconds to pass device
        countdownTime: 3  // battle countdown
    }
};

// Quiz mode state
let quizMode = false;
let quizSessionId = null;
let preloadedQuizGame = false;

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Bind event listeners
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('continue-btn').addEventListener('click', continueAfterResult);
    document.getElementById('stalemate-continue-btn').addEventListener('click', continueAfterResult);
    document.getElementById('play-again-btn').addEventListener('click', resetGame);
    
    const resignBtn = document.getElementById('resign-btn');
    if (resignBtn) {
        resignBtn.addEventListener('click', resignGame);
        console.log('Resign button bound');
    } else {
        console.error('Resign button not found!');
    }

    // Check for quiz mode (from URL parameters)
    checkQuizMode();
});

// ========================================
// GAME FLOW
// ========================================

// Check if coming from quiz mode
function checkQuizMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    if (mode === 'quiz') {
        quizMode = true;
        quizSessionId = urlParams.get('session');
        
        const p1Name = urlParams.get('p1name');
        const p2Name = urlParams.get('p2name');
        const p1Uid = urlParams.get('p1uid');
        const p2Uid = urlParams.get('p2uid');
        const p1CardsStr = urlParams.get('p1cards');
        const p2CardsStr = urlParams.get('p2cards');
        
        if (p1CardsStr && p2CardsStr) {
            try {
                const p1CardValues = JSON.parse(decodeURIComponent(p1CardsStr));
                const p2CardValues = JSON.parse(decodeURIComponent(p2CardsStr));
                
                console.log("Quiz Mode - Starting with cards:", { p1CardValues, p2CardValues });
                
                // Start game with quiz cards directly
                startQuizGame(p1Name, p2Name, p1Uid, p2Uid, p1CardValues, p2CardValues);
            } catch (e) {
                console.error("Error parsing quiz cards:", e);
            }
        }
    }
}

// Start game with quiz-earned cards
async function startQuizGame(p1Name, p2Name, p1Uid, p2Uid, p1CardValues, p2CardValues) {
    GameState.players[1].name = p1Name;
    GameState.players[2].name = p2Name;
    GameState.players[1].uid = p1Uid;
    GameState.players[2].uid = p2Uid;
    
    // Convert card values to card objects with IDs
    GameState.cardIdCounter = 0;
    GameState.players[1].cards = p1CardValues.map(value => ({
        id: ++GameState.cardIdCounter,
        value: value
    }));
    GameState.players[2].cards = p2CardValues.map(value => ({
        id: ++GameState.cardIdCounter,
        value: value
    }));
    
    // Update settings based on card count
    GameState.settings.cardCount = p1CardValues.length;
    
    // Calculate initial scores
    updateScores();
    
    // Set timer based on card count
    GameState.timer.totalSeconds = GameState.settings.cardCount * 2 * 60;
    GameState.timer.remaining = GameState.timer.totalSeconds;
    
    // Reset game state
    GameState.round = 1;
    GameState.currentPlayer = 1;
    GameState.players[1].playedCard = null;
    GameState.players[2].playedCard = null;
    GameState.players[1].lastPlayedCardId = null;
    GameState.players[2].lastPlayedCardId = null;
    GameState.isActive = true;
    
    // Create Firebase game session
    createGameSession(
        p1Name, p2Name,
        GameState.players[1].cards.map(c => c.value),
        GameState.players[2].cards.map(c => c.value)
    ).then(result => {
        GameState.gameId = result.id;
        console.log("Quiz Game created:", result.id, result.demo ? "(Demo Mode)" : "");
        
        // Link game to quiz session
        if (quizSessionId && typeof updateQuizSessionStatus === 'function') {
            updateQuizSessionStatus(quizSessionId, 'game_in_progress', { gameId: result.id });
        }
    });
    
    // Update UI
    updateLeaderboardDisplay();
    updateRoundDisplay();

    // Show the lobby first (restored behavior)
    const p1NameInput = document.getElementById('player1-name');
    const p2NameInput = document.getElementById('player2-name');
    const p1UidInput = document.getElementById('player1-uid');
    const p2UidInput = document.getElementById('player2-uid');
    const p2InputSection = document.getElementById('player2-input-section');
    const p2VerifiedSection = document.getElementById('player2-verified-section');
    const p2VerifiedName = document.getElementById('p2-verified-name');
    const p2WinsEl = document.getElementById('p2-wins');
    const p2LossesEl = document.getElementById('p2-losses');
    const p2ProfilePic = document.getElementById('p2-profile-pic');
    const p2Status = document.getElementById('player2-status');
    const p2LockBadge = document.getElementById('p2-lock-badge');
    const changePlayerBtn = document.querySelector('.lobby-change-btn');
    const p2PlusBtn = document.getElementById('p2-profile-plus');
    const p2ProfileWrapper = document.getElementById('p2-profile-wrapper');
    const startBtn = document.getElementById('start-game-btn');

    if (p1NameInput) p1NameInput.value = p1Name || 'Player 1';
    if (p2NameInput) p2NameInput.value = p2Name || 'Player 2';
    if (p1UidInput) p1UidInput.value = p1Uid || '';
    if (p2UidInput) p2UidInput.value = p2Uid || '';

    if (p2InputSection) p2InputSection.style.display = 'none';
    if (p2VerifiedSection) p2VerifiedSection.style.display = 'block';
    if (p2VerifiedName) p2VerifiedName.textContent = p2Name || 'Player 2';
    if (p2WinsEl) p2WinsEl.textContent = '0';
    if (p2LossesEl) p2LossesEl.textContent = '0';
    if (p2ProfilePic) p2ProfilePic.src = 'userprofiledefault.png';
    if (p2LockBadge) p2LockBadge.style.display = 'inline-flex';
    if (changePlayerBtn) changePlayerBtn.style.display = 'none';
    if (p2PlusBtn) p2PlusBtn.style.display = 'none';
    if (p2ProfileWrapper) p2ProfileWrapper.style.pointerEvents = 'none';
    if (p2Status) {
        p2Status.textContent = 'Player 2 locked from quiz session.';
        p2Status.className = 'player2-status success';
    }
    if (startBtn) startBtn.disabled = false;

    if (typeof window !== 'undefined') {
        window.lockedQuizPlayer2 = true;
    }

    if (p2Uid && typeof getUserByUid === 'function') {
        try {
            const p2UserData = await getUserByUid(p2Uid);
            if (p2UserData) {
                if (p2VerifiedName && p2UserData.displayName) p2VerifiedName.textContent = p2UserData.displayName;
                if (p2NameInput && p2UserData.displayName) p2NameInput.value = p2UserData.displayName;
                if (p2WinsEl) p2WinsEl.textContent = p2UserData.wins || 0;
                if (p2LossesEl) p2LossesEl.textContent = p2UserData.losses || 0;
            }
        } catch (error) {
            console.warn('Could not load Player 2 stats for quiz lobby:', error);
        }
    }

    if (p2Uid && typeof getProfilePicture === 'function') {
        try {
            const p2Pic = await getProfilePicture(p2Uid);
            if (p2Pic && p2ProfilePic) {
                p2ProfilePic.src = p2Pic;
            }
        } catch (error) {
            console.warn('Could not load Player 2 profile pic for quiz lobby:', error);
        }
    }

    preloadedQuizGame = true;
    showScreen('start-screen');
}

async function startGame() {
    if (preloadedQuizGame) {
        preloadedQuizGame = false;
        showScreen('game-screen');
        setPlayerTheme(1);
        renderPlayerHand();
        startGameTimer();
        return;
    }

    // Get player names and UIDs
    const p1Name = document.getElementById('player1-name').value.trim() || 'Player 1';
    const p2Name = document.getElementById('player2-name').value.trim() || 'Player 2';
    const p1Uid = document.getElementById('player1-uid')?.value || null;
    const p2Uid = document.getElementById('player2-uid')?.value || null;
    
    GameState.players[1].name = p1Name;
    GameState.players[2].name = p2Name;
    GameState.players[1].uid = p1Uid;
    GameState.players[2].uid = p2Uid;
    
    console.log("Starting game with:", { p1Name, p1Uid, p2Name, p2Uid });
    
    // Generate random cards for both players
    GameState.players[1].cards = generateRandomCards(GameState.settings.cardCount);
    GameState.players[2].cards = generateRandomCards(GameState.settings.cardCount);
    
    // Calculate initial scores
    updateScores();
    
    // Set timer based on card count
    GameState.timer.totalSeconds = GameState.settings.cardCount * 2 * 60;
    GameState.timer.remaining = GameState.timer.totalSeconds;
    
    // Reset game state
    GameState.round = 1;
    GameState.currentPlayer = 1;
    GameState.cardIdCounter = 0; // Reset card ID counter
    GameState.players[1].playedCard = null;
    GameState.players[2].playedCard = null;
    GameState.players[1].lastPlayedCardId = null;
    GameState.players[2].lastPlayedCardId = null;
    GameState.isActive = true;
    
    // Create Firebase game session
    createGameSession(
        p1Name, p2Name,
        GameState.players[1].cards.map(c => c.value),
        GameState.players[2].cards.map(c => c.value)
    ).then(result => {
        GameState.gameId = result.id;
        console.log("Game created:", result.id, result.demo ? "(Demo Mode)" : "");
    });
    
    // Update UI
    updateLeaderboardDisplay();
    updateRoundDisplay();
    
    // Switch to game screen
    showScreen('game-screen');
    setPlayerTheme(1);
    renderPlayerHand();
    
    // Start the game timer
    startGameTimer();
}

function generateRandomCards(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
        cards.push({
            id: ++GameState.cardIdCounter,
            value: Math.floor(Math.random() * 5) + 1 // Values 1-5
        });
    }
    return cards;
}

function updateScores() {
    GameState.players[1].score = GameState.players[1].cards.reduce((a, card) => a + card.value, 0);
    GameState.players[2].score = GameState.players[2].cards.reduce((a, card) => a + card.value, 0);
    updateLeaderboardDisplay();
}

// ========================================
// PLAYER TURN MANAGEMENT
// ========================================

function getInitials(name) {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 3);
}

function setPlayerTheme(playerNum) {
    document.body.classList.remove('player1-active', 'player2-active');
    document.body.classList.add(`player${playerNum}-active`);
    
    const currentPlayerName = GameState.players[playerNum].name;
    
    // Update banner with avatar
    document.getElementById('current-player-name').textContent = `${currentPlayerName}'s Turn`;
    document.getElementById('banner-avatar-initials').textContent = getInitials(currentPlayerName);
    
    // Update player number label
    const playerNumLabel = document.getElementById('player-number-label');
    if (playerNumLabel) {
        playerNumLabel.textContent = `PLAYER ${playerNum}`;
    }
    
    // Update card frame image based on player
    const frameImg = document.getElementById('card-frame-img');
    if (frameImg) {
        frameImg.src = playerNum === 1 ? 'playcardframeplayer1.png' : 'playcardframeplayer2.png';
    }
    
    // Clear played card overlay
    const overlay = document.getElementById('played-card-overlay');
    if (overlay) {
        overlay.innerHTML = '';
    }
    
    // Reset card slot state
    const playerSlot = document.getElementById('player-card-slot');
    playerSlot.classList.add('empty');
    playerSlot.classList.remove('has-card');
    
    // Update game header username
    const gameUsername = document.getElementById('game-username');
    if (gameUsername) {
        gameUsername.textContent = currentPlayerName;
    }
    const gameAvatarLetter = document.getElementById('game-avatar-letter');
    if (gameAvatarLetter) {
        gameAvatarLetter.textContent = getInitials(currentPlayerName).charAt(0);
    }
    
    // Load profile picture for current player into banner avatar
    const bannerAvatarImg = document.getElementById('banner-avatar-img');
    const bannerAvatarInitials = document.getElementById('banner-avatar-initials');
    const playerUid = GameState.players[playerNum].uid;
    
    if (bannerAvatarImg && playerUid && typeof getProfilePicture === 'function') {
        getProfilePicture(playerUid).then(picUrl => {
            if (picUrl) {
                bannerAvatarImg.src = picUrl;
                bannerAvatarImg.style.display = 'block';
                if (bannerAvatarInitials) bannerAvatarInitials.style.display = 'none';
            } else {
                bannerAvatarImg.src = 'userprofiledefault.png';
                bannerAvatarImg.style.display = 'block';
                if (bannerAvatarInitials) bannerAvatarInitials.style.display = 'none';
            }
        }).catch(() => {
            bannerAvatarImg.src = 'userprofiledefault.png';
            bannerAvatarImg.style.display = 'block';
            if (bannerAvatarInitials) bannerAvatarInitials.style.display = 'none';
        });
    } else if (bannerAvatarImg) {
        bannerAvatarImg.src = 'userprofiledefault.png';
        bannerAvatarImg.style.display = 'block';
        if (bannerAvatarInitials) bannerAvatarInitials.style.display = 'none';
    }
    
    // Also update game header avatar for current player
    const gameAvatarImg = document.getElementById('game-avatar-img');
    if (gameAvatarImg && playerUid && typeof getProfilePicture === 'function') {
        getProfilePicture(playerUid).then(picUrl => {
            if (picUrl) {
                gameAvatarImg.src = picUrl;
                gameAvatarImg.style.display = 'block';
                if (gameAvatarLetter) gameAvatarLetter.style.display = 'none';
            }
        }).catch(() => {});
    }
}

function renderPlayerHand() {
    const container = document.getElementById('cards-container');
    container.innerHTML = '';
    
    const player = GameState.players[GameState.currentPlayer];
    
    player.cards.forEach((card, index) => {
        const cardElement = createCardElement(card.value, card.id);
        
        // Check if card is on cooldown (by unique ID)
        if (card.id === player.lastPlayedCardId) {
            cardElement.classList.add('disabled');
            cardElement.title = 'This card is on cooldown';
        } else {
            cardElement.addEventListener('click', () => selectCard(card));
        }
        
        container.appendChild(cardElement);
    });
}

function createCardElement(value, cardId) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.value = value;
    card.dataset.cardId = cardId;
    
    // Convert to number for comparison
    const numValue = parseInt(value);
    
    // Special image card for value 5
    if (numValue === 5) {
        card.classList.add('card-special');
        card.classList.add('card-special-5');
        card.innerHTML = `
            <div class="card-inner card-image">
                <img src="card-level-5.png" alt="Level 5 Card" />
            </div>
            <div class="card-badge-5">
                <img src="badge-5.png" alt="5" />
            </div>
        `;
    } else if (numValue === 4) {
        card.classList.add('card-special');
        card.classList.add('card-special-4');
        card.innerHTML = `
            <div class="card-inner card-image">
                <img src="card-level-4.png" alt="Level 4 Card" />
            </div>
            <div class="card-badge-4">
                <img src="badge-4.png" alt="4" />
            </div>
        `;
    } else if (numValue === 3) {
        card.classList.add('card-special');
        card.classList.add('card-special-3');
        card.innerHTML = `
            <div class="card-inner card-image">
                <img src="card-level-3.png" alt="Level 3 Card" />
            </div>
            <div class="card-badge-3">
                <img src="badge-3.png" alt="3" />
            </div>
        `;
    } else if (numValue === 2) {
        card.classList.add('card-special');
        card.classList.add('card-special-2');
        card.innerHTML = `
            <div class="card-inner card-image">
                <img src="card-level-2.png" alt="Level 2 Card" />
            </div>
            <div class="card-badge-2">
                <img src="badge-2.png" alt="2" />
            </div>
        `;
    } else if (numValue === 1) {
        card.classList.add('card-special');
        card.classList.add('card-special-1');
        card.innerHTML = `
            <div class="card-inner card-image">
                <img src="card-level-1.png" alt="Level 1 Card" />
            </div>
            <div class="card-badge-1">
                <img src="badge-1.png" alt="1" />
            </div>
        `;
    } else {
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-frame"></div>
                <span class="card-corner top-left">${value}</span>
                <span class="card-value">${value}</span>
                <span class="card-corner bottom-right">${value}</span>
            </div>
        `;
    }
    
    return card;
}

function selectCard(card) {
    const player = GameState.players[GameState.currentPlayer];
    
    // Check cooldown (by unique card ID)
    if (card.id === player.lastPlayedCardId) {
        const cardElement = document.querySelector(`[data-card-id="${card.id}"]`);
        cardElement.classList.add('shake');
        setTimeout(() => cardElement.classList.remove('shake'), 500);
        showMessage("This card is on cooldown!");
        return;
    }
    
    // Play card selection sound
    const selectSound = document.getElementById('card-select-sound');
    if (selectSound) {
        selectSound.currentTime = 0;
        selectSound.play().catch(err => console.log('Sound blocked:', err));
    }
    
    // Remove previous selection
    document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
    
    // Select this card
    const cardElement = document.querySelector(`[data-card-id="${card.id}"]`);
    cardElement.classList.add('selected');
    
    // After a short delay with selection animation, play the card
    setTimeout(() => playSelectedCard(card, cardElement), 500);
}

function playSelectedCard(card, cardElement) {
    const player = GameState.players[GameState.currentPlayer];
    
    // Add explosion animation to the selected card
    if (cardElement) {
        cardElement.classList.remove('selected');
        cardElement.classList.add('playing');
    }
    
    // Set the played card (store the entire card object)
    player.playedCard = card;
    
    // Update Firebase
    playCard(GameState.gameId, GameState.currentPlayer, card.value);
    
    // Show card in the played overlay (on top of frame) after explosion animation
    setTimeout(() => {
        const playerSlot = document.getElementById('player-card-slot');
        const overlay = document.getElementById('played-card-overlay');
        
        playerSlot.classList.remove('empty');
        playerSlot.classList.add('has-card');
        
        if (overlay) {
            overlay.innerHTML = '';
            const playedCardElement = createCardElement(card.value, -1);
            playedCardElement.classList.add('played-card');
            overlay.appendChild(playedCardElement);
            
            // Add appear animation
            playedCardElement.style.animation = 'cardAppear 0.4s ease-out';
        }
        
        // Check if both players have played
        if (GameState.players[1].playedCard !== null && GameState.players[2].playedCard !== null) {
            // Both played - show 321 countdown then battle!
            setTimeout(start321Countdown, 800);
        } else {
            // Switch to other player
            setTimeout(startTransition, 800);
        }
    }, 400);
}

// ========================================
// HEADER CLONE HELPER
// ========================================

function cloneGameHeader(targetId) {
    const targetHeader = document.getElementById(targetId);
    const gameHeader = document.getElementById('game-header');
    if (targetHeader && gameHeader) {
        targetHeader.innerHTML = gameHeader.innerHTML;
        
        // Rebind hamburger menu on the cloned header
        const clonedHamburgerBtn = targetHeader.querySelector('.hamburger-btn');
        const clonedHamburgerDropdown = targetHeader.querySelector('.hamburger-dropdown');
        if (clonedHamburgerBtn && clonedHamburgerDropdown) {
            clonedHamburgerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                clonedHamburgerDropdown.classList.toggle('open');
            });
        }
        
        // Rebind logout on cloned header
        const clonedLogoutBtn = targetHeader.querySelector('.game-logout-btn');
        if (clonedLogoutBtn) {
            clonedLogoutBtn.addEventListener('click', () => {
                if (typeof auth !== 'undefined' && auth) {
                    auth.signOut().then(() => { window.location.href = 'login.html'; });
                }
            });
        }
    }
}

// ========================================
// TRANSITION BETWEEN PLAYERS
// ========================================

function startTransition() {
    const nextPlayer = GameState.currentPlayer === 1 ? 2 : 1;
    const nextPlayerName = GameState.players[nextPlayer].name;
    
    document.getElementById('next-player-name').textContent = nextPlayerName;
    
    // Clone header into transition screen
    cloneGameHeader('transition-header');
    
    showScreen('transition-screen', true);
    
    let countdown = GameState.settings.transitionTime;
    const timerDisplay = document.getElementById('transition-timer');
    timerDisplay.textContent = countdown;
    
    const interval = setInterval(() => {
        countdown--;
        timerDisplay.textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(interval);
            hideScreen('transition-screen');
            
            // Switch player
            GameState.currentPlayer = nextPlayer;
            setPlayerTheme(nextPlayer);
            renderPlayerHand();
        }
    }, 1000);
}

// ========================================
// 321 COUNTDOWN BEFORE BATTLE
// ========================================

function start321Countdown() {
    // Set player names
    document.getElementById('countdown321-p1-name').textContent = GameState.players[1].name;
    document.getElementById('countdown321-p2-name').textContent = GameState.players[2].name;
    
    // Clone header into 321 screen
    cloneGameHeader('countdown321-header');
    
    const numberEl = document.getElementById('countdown321-number');
    numberEl.textContent = '3';
    
    showScreen('countdown-321-screen', true);
    
    // Play 321 sound
    const sound321 = document.getElementById('countdown-321-sound');
    if (sound321) {
        sound321.currentTime = 0;
        sound321.play().catch(err => console.log('321 sound blocked:', err));
    }
    
    let count = 3;
    const interval321 = setInterval(() => {
        count--;
        if (count > 0) {
            numberEl.textContent = count;
        } else {
            clearInterval(interval321);
            hideScreen('countdown-321-screen');
            startBattleReveal();
        }
    }, 1000);
}

// ========================================
// BATTLE REVEAL
// ========================================

function startBattleReveal() {
    // Clone the game header into battle screen
    cloneGameHeader('battle-header');

    // Reset battle screen state
    const battleScreen = document.getElementById('battle-screen');
    const resultTitle = document.getElementById('battle-result-title');
    const p1Wrapper = document.getElementById('battle-p1-card');
    const p2Wrapper = document.getElementById('battle-p2-card');
    const vsV = document.getElementById('vs-v-letter');
    const vsS = document.getElementById('vs-s-letter');
    const vsContainer = document.getElementById('battle-vs-container');
    const resultInfoPanel = document.getElementById('result-info-panel');
    const stalematePanel = document.getElementById('stalemate-info-panel');
    const winnerLabel = document.getElementById('winner-label');

    // Reset everything
    resultTitle.classList.remove('visible');
    vsV.classList.remove('animate');
    vsS.classList.remove('animate');
    vsContainer.classList.remove('fade-out');
    vsContainer.style.opacity = '';
    p1Wrapper.classList.remove('flipping', 'winner-glow', 'loser-glow',
        'winner-glow-1', 'winner-glow-2', 'winner-glow-3', 'winner-glow-4', 'winner-glow-5',
        'loser-glow-1', 'loser-glow-2', 'loser-glow-3', 'loser-glow-4', 'loser-glow-5');
    p2Wrapper.classList.remove('flipping', 'winner-glow', 'loser-glow',
        'winner-glow-1', 'winner-glow-2', 'winner-glow-3', 'winner-glow-4', 'winner-glow-5',
        'loser-glow-1', 'loser-glow-2', 'loser-glow-3', 'loser-glow-4', 'loser-glow-5');
    resultInfoPanel.style.display = 'none';
    stalematePanel.style.display = 'none';
    winnerLabel.style.display = 'none';

    // Set pre-reveal cards
    p1Wrapper.innerHTML = '<img src="prerevealcard.png" alt="Hidden Card" class="prereveal-card-img">';
    p2Wrapper.innerHTML = '<img src="prerevealcard.png" alt="Hidden Card" class="prereveal-card-img">';

    // Show battle screen
    showScreen('battle-screen', true);

    // Show RESULT title immediately
    setTimeout(() => {
        resultTitle.classList.add('visible');
    }, 300);

    // At 2 seconds, animate VS letters + play countdown sound (3rd-4th second only)
    setTimeout(() => {
        vsV.classList.add('animate');
        vsS.classList.add('animate');
        
        // Play entire fight sound
        const fightSound = document.getElementById('countdown-sound');
        if (fightSound) {
            fightSound.currentTime = 0;
            fightSound.play().catch(err => console.log('Sound blocked:', err));
        }
    }, 2000);

    // Give users 2.5 seconds to see the VS, then reveal cards at 4.5s
    setTimeout(() => {
        revealCards();
    }, 4500);
}

function revealCards() {
    const p1Card = GameState.players[1].playedCard;
    const p2Card = GameState.players[2].playedCard;
    const p1Wrapper = document.getElementById('battle-p1-card');
    const p2Wrapper = document.getElementById('battle-p2-card');

    // Create card elements for reveal
    const p1CardEl = createCardElement(p1Card.value, p1Card.id);
    const p2CardEl = createCardElement(p2Card.value, p2Card.id);

    // Flip animation: hide prereveal, show actual card
    p1Wrapper.classList.add('flipping');
    p2Wrapper.classList.add('flipping');

    setTimeout(() => {
        // At midpoint of flip, swap content
        p1Wrapper.innerHTML = '';
        p2Wrapper.innerHTML = '';

        const p1Reveal = document.createElement('div');
        p1Reveal.className = 'battle-revealed-card';
        p1Reveal.appendChild(p1CardEl);
        p1Wrapper.appendChild(p1Reveal);

        const p2Reveal = document.createElement('div');
        p2Reveal.className = 'battle-revealed-card';
        p2Reveal.appendChild(p2CardEl);
        p2Wrapper.appendChild(p2Reveal);

        p1Wrapper.classList.remove('flipping');
        p2Wrapper.classList.remove('flipping');
    }, 400);

    // After reveal animation, show result
    setTimeout(() => {
        // Check if card 5 wins for cutscene
        const card5Wins = (p1Card.value === 5 && p1Card.value > p2Card.value) ||
                          (p2Card.value === 5 && p2Card.value > p1Card.value);

        if (card5Wins) {
            playCard5VictoryCutscene(() => {
                showResultOnBattleScreen(p1Card, p2Card);
            });
        } else {
            showResultOnBattleScreen(p1Card, p2Card);
        }
    }, 1500);
}

function showResultOnBattleScreen(p1Card, p2Card) {
    const p1Wrapper = document.getElementById('battle-p1-card');
    const p2Wrapper = document.getElementById('battle-p2-card');
    const resultInfoPanel = document.getElementById('result-info-panel');
    const stalematePanel = document.getElementById('stalemate-info-panel');
    const winnerLabel = document.getElementById('winner-label');
    
    // Fade out VS letters when result shows
    const vsContainer = document.getElementById('battle-vs-container');
    if (vsContainer) {
        vsContainer.classList.add('fade-out');
    }

    // Process game logic (transfer cards, cooldowns, etc.)
    if (p1Card.value > p2Card.value) {
        // Player 1 wins - use card-specific glow
        p1Wrapper.classList.add('winner-glow', 'winner-glow-' + p1Card.value);
        p2Wrapper.classList.add('loser-glow', 'loser-glow-' + p2Card.value);

        document.getElementById('result-winner-name').textContent = GameState.players[1].name.toUpperCase();
        document.getElementById('result-won-text').textContent = 'WON !';
        document.getElementById('result-capture-text').textContent = `Captured the ${p2Card.value} card !`;

        // Position winner label on left (player 1) side
        winnerLabel.style.left = '12%';
        winnerLabel.style.right = 'auto';
        winnerLabel.style.display = 'block';

        resultInfoPanel.style.display = 'block';
        stalematePanel.style.display = 'none';

        // Transfer card
        GameState.players[1].cards.push(p2Card);
        const idx = GameState.players[2].cards.findIndex(c => c.id === p2Card.id);
        if (idx > -1) GameState.players[2].cards.splice(idx, 1);

        GameState.players[1].lastPlayedCardId = p1Card.id;
        GameState.players[2].lastPlayedCardId = null;

        // Play capture sound
        const captureSound = document.getElementById('capture-card-sound');
        if (captureSound) {
            captureSound.currentTime = 0;
            captureSound.play().catch(err => console.log('Sound blocked:', err));
        }

    } else if (p2Card.value > p1Card.value) {
        // Player 2 wins - use card-specific glow
        p2Wrapper.classList.add('winner-glow', 'winner-glow-' + p2Card.value);
        p1Wrapper.classList.add('loser-glow', 'loser-glow-' + p1Card.value);

        document.getElementById('result-winner-name').textContent = GameState.players[2].name.toUpperCase();
        document.getElementById('result-won-text').textContent = 'WON !';
        document.getElementById('result-capture-text').textContent = `Captured the ${p1Card.value} card !`;

        // Position winner label on right (player 2) side
        winnerLabel.style.right = '12%';
        winnerLabel.style.left = 'auto';
        winnerLabel.style.display = 'block';

        resultInfoPanel.style.display = 'block';
        stalematePanel.style.display = 'none';

        // Transfer card
        GameState.players[2].cards.push(p1Card);
        const idx = GameState.players[1].cards.findIndex(c => c.id === p1Card.id);
        if (idx > -1) GameState.players[1].cards.splice(idx, 1);

        GameState.players[1].lastPlayedCardId = null;
        GameState.players[2].lastPlayedCardId = p2Card.id;

        // Play capture sound
        const captureSound = document.getElementById('capture-card-sound');
        if (captureSound) {
            captureSound.currentTime = 0;
            captureSound.play().catch(err => console.log('Sound blocked:', err));
        }

    } else {
        // Stalemate
        winnerLabel.style.display = 'none';
        resultInfoPanel.style.display = 'none';
        stalematePanel.style.display = 'block';

        GameState.players[1].lastPlayedCardId = p1Card.id;
        GameState.players[2].lastPlayedCardId = p2Card.id;
    }

    // Update scores
    updateScores();

    // Update Firebase
    updateGameState(GameState.gameId, {
        'players/player1/cards': GameState.players[1].cards.map(c => c.value),
        'players/player2/cards': GameState.players[2].cards.map(c => c.value),
        'players/player1/score': GameState.players[1].score,
        'players/player2/score': GameState.players[2].score,
        'round': GameState.round + 1
    });
}

// ========================================
// CARD 5 VICTORY CUTSCENE
// ========================================

function playCard5VictoryCutscene(onComplete) {
    const overlay = document.getElementById('card5-video-overlay');
    const video = document.getElementById('card5-victory-video');
    const skipBtn = document.getElementById('skip-video-btn');
    
    // Guard to prevent onComplete being called multiple times
    let completed = false;
    function safeComplete() {
        if (completed) return;
        completed = true;
        onComplete();
    }
    
    function hideCard5Cutscene() {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.add('hidden');
            video.pause();
            video.currentTime = 0;
        }, 500);
    }
    
    // Handle video end
    function handleVideoEnd() {
        hideCard5Cutscene();
        safeComplete();
    }
    
    // Handle skip button
    function handleSkip() {
        video.pause();
        hideCard5Cutscene();
        safeComplete();
    }
    
    // Clean up old listeners before adding new ones
    video.removeEventListener('ended', handleVideoEnd);
    skipBtn.removeEventListener('click', handleSkip);
    
    // Reset video to start
    video.currentTime = 0;
    
    // Show the overlay
    overlay.classList.remove('hidden');
    overlay.classList.remove('fade-out');
    
    // Add event listeners
    video.addEventListener('ended', handleVideoEnd, { once: true });
    skipBtn.addEventListener('click', handleSkip, { once: true });
    
    // Play the video
    video.play().catch(err => {
        console.warn('Video autoplay blocked:', err);
        // If autoplay is blocked, skip to result immediately
        hideCard5Cutscene();
        safeComplete();
    });
}

// ========================================
// RESULT HANDLING
// ========================================

function showResult(p1Card, p2Card) {
    // Legacy function — now handled by showResultOnBattleScreen
    // Called only as fallback
    showResultOnBattleScreen(p1Card, p2Card);
}

function continueAfterResult() {
    hideScreen('battle-screen');
    hideScreen('result-screen');
    
    // Check for game over conditions
    if (GameState.players[1].cards.length === 0 || 
        GameState.players[2].cards.length === 0) {
        endGame();
        return;
    }
    
    // Start new round
    GameState.round++;
    GameState.players[1].playedCard = null;
    GameState.players[2].playedCard = null;
    
    // Player 1 starts each round
    GameState.currentPlayer = 1;
    
    updateRoundDisplay();
    setPlayerTheme(1);
    renderPlayerHand();
}

// ========================================
// TIMER
// ========================================

function startGameTimer() {
    if (GameState.timer.interval) {
        clearInterval(GameState.timer.interval);
    }
    
    updateTimerDisplay();
    
    GameState.timer.interval = setInterval(() => {
        if (!GameState.isActive) return;
        
        GameState.timer.remaining--;
        updateTimerDisplay();
        
        if (GameState.timer.remaining <= 0) {
            clearInterval(GameState.timer.interval);
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(GameState.timer.remaining / 60);
    const seconds = GameState.timer.remaining % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const timerElement = document.getElementById('timer-display');
    timerElement.textContent = display;
    
    // Warning state when less than 1 minute
    if (GameState.timer.remaining <= 60) {
        timerElement.classList.add('warning');
    } else {
        timerElement.classList.remove('warning');
    }
}

// ========================================
// LEADERBOARD
// ========================================

function updateLeaderboardDisplay() {
    const p1 = GameState.players[1];
    const p2 = GameState.players[2];
    
    document.getElementById('lb-p1-name').textContent = p1.name;
    document.getElementById('lb-p1-score').textContent = p1.score;
    
    document.getElementById('lb-p2-name').textContent = p2.name;
    document.getElementById('lb-p2-score').textContent = p2.score;
}

function updateRoundDisplay() {
    document.getElementById('round-number').textContent = GameState.round;
}

// ========================================
// GAME OVER
// ========================================

function endGame() {
    GameState.isActive = false;
    
    if (GameState.timer.interval) {
        clearInterval(GameState.timer.interval);
    }
    
    const p1 = GameState.players[1];
    const p2 = GameState.players[2];
    
    // Determine winner
    const winner = p1.score > p2.score ? p1 : p2;
    const loser = p1.score > p2.score ? p2 : p1;
    const isTie = p1.score === p2.score;
    
    // Populate new gameover screen
    if (isTie) {
        document.getElementById('gameover-winner-name').textContent = p1.name;
        document.getElementById('gameover-winner-pts').textContent = `${p1.score} pts`;
        document.getElementById('gameover-winner-note').textContent = 'TIE';
        document.getElementById('gameover-loser-name').textContent = p2.name;
        document.getElementById('gameover-loser-pts').textContent = `${p2.score} pts`;
        document.getElementById('gameover-loser-note').textContent = '';
    } else {
        document.getElementById('gameover-winner-name').textContent = winner.name;
        document.getElementById('gameover-winner-pts').textContent = `${winner.score} pts`;
        document.getElementById('gameover-winner-note').textContent = '';
        document.getElementById('gameover-loser-name').textContent = loser.name;
        document.getElementById('gameover-loser-pts').textContent = `${loser.score} pts`;
        document.getElementById('gameover-loser-note').textContent = '';
    }
    
    // Update Firebase game state with winner info
    updateGameState(GameState.gameId, {
        'status': 'completed',
        'winner': isTie ? 'TIE' : winner.name,
        'resigned': false,
        'endTime': new Date().toISOString(),
        'players/player1/score': p1.score,
        'players/player2/score': p2.score
    });
    
    // Update user stats using UID if available, fallback to name
    if (!isTie) {
        if (winner.uid) {
            updateUserStatsByUid(winner.uid, winner.score, true, false);
        } else {
            updateUserStats(winner.name, winner.score, true, false);
        }
        if (loser.uid) {
            updateUserStatsByUid(loser.uid, loser.score, false, false);
        } else {
            updateUserStats(loser.name, loser.score, false, false);
        }
    } else {
        // Tie - both get a game played but no win
        if (p1.uid) {
            updateUserStatsByUid(p1.uid, p1.score, false, false);
        } else {
            updateUserStats(p1.name, p1.score, false, false);
        }
        if (p2.uid) {
            updateUserStatsByUid(p2.uid, p2.score, false, false);
        } else {
            updateUserStats(p2.name, p2.score, false, false);
        }
    }
    
    // Save to Firebase leaderboard (pass actual winner, not score-based)
    updateLeaderboard(p1.name, p1.score, p2.name, p2.score, GameState.gameId, isTie ? 'Tie' : winner.name);
    
    // If quiz mode, mark quiz session as completed
    if (quizMode && quizSessionId && typeof updateQuizSessionStatus === 'function') {
        updateQuizSessionStatus(quizSessionId, 'completed', {
            gameId: GameState.gameId,
            winner: isTie ? 'Tie' : winner.name,
            winnerUid: isTie ? null : (winner.uid || null),
            finalScores: { player1: p1.score, player2: p2.score }
        });
    }
    
    // Hide any overlays and show game over
    hideScreen('transition-screen');
    hideScreen('countdown-321-screen');
    hideScreen('battle-screen');
    hideScreen('result-screen');
    hideScreen('game-screen');
    
    // Play winner sound
    const winnerSound = document.getElementById('winner-sound');
    if (winnerSound) {
        winnerSound.currentTime = 0;
        winnerSound.volume = 1.0;
        winnerSound.play().catch(err => console.log('Winner sound blocked:', err));
    }
    
    // Clone header into gameover screen
    cloneGameHeader('gameover-header');
    
    // Force display for gameover screen
    const gameoverScreen = document.getElementById('gameover-screen');
    gameoverScreen.style.display = 'flex';
    gameoverScreen.classList.add('active');
}

function resignGame() {
    console.log('Resign clicked, isActive:', GameState.isActive);
    
    if (!GameState.isActive) {
        alert('No active game to resign from!');
        return;
    }
    
    const resigningPlayer = GameState.currentPlayer;
    const winningPlayer = resigningPlayer === 1 ? 2 : 1;
    
    // Confirm resignation
    if (!confirm(`${GameState.players[resigningPlayer].name}, are you sure you want to resign? ${GameState.players[winningPlayer].name} will win!`)) {
        return;
    }
    
    // Stop the timer
    if (GameState.timer.interval) {
        clearInterval(GameState.timer.interval);
        GameState.timer.interval = null;
    }
    
    GameState.isActive = false;
    
    // Get player info
    const winner = GameState.players[winningPlayer];
    const loser = GameState.players[resigningPlayer];
    
    // Update new gameover screen elements
    document.getElementById('gameover-winner-name').textContent = winner.name;
    document.getElementById('gameover-winner-pts').textContent = `${winner.score} pts`;
    document.getElementById('gameover-winner-note').textContent = '(WON from resignation)';
    
    document.getElementById('gameover-loser-name').textContent = loser.name;
    document.getElementById('gameover-loser-pts').textContent = `${loser.score} pts`;
    document.getElementById('gameover-loser-note').textContent = 'RESIGNED';
    
    // Update user stats: resigning player loses, other player wins (using UID if available)
    if (loser.uid) {
        updateUserStatsByUid(loser.uid, loser.score, false, true); // resigned = true
    } else {
        updateUserStats(loser.name, loser.score, false, true);
    }
    if (winner.uid) {
        updateUserStatsByUid(winner.uid, winner.score, true, false);
    } else {
        updateUserStats(winner.name, winner.score, true, false);
    }
    
    // Update Firebase game state with winner and resigned fields
    updateGameState(GameState.gameId, {
        'status': 'completed',
        'winner': winner.name,
        'resigned': true,
        'resignedBy': loser.name,
        'endTime': new Date().toISOString(),
        'players/player1/score': GameState.players[1].score,
        'players/player2/score': GameState.players[2].score
    });
    
    // Also update leaderboard (pass actual winner - the one who didn't resign)
    updateLeaderboard(
        GameState.players[1].name, 
        GameState.players[1].score, 
        GameState.players[2].name, 
        GameState.players[2].score, 
        GameState.gameId,
        winner.name
    );

    // If quiz mode, mark quiz session as completed on resignation too
    if (quizMode && quizSessionId && typeof updateQuizSessionStatus === 'function') {
        updateQuizSessionStatus(quizSessionId, 'completed', {
            gameId: GameState.gameId,
            winner: winner.name,
            winnerUid: winner.uid || null,
            resigned: true,
            resignedBy: loser.name,
            finalScores: { player1: GameState.players[1].score, player2: GameState.players[2].score }
        });
    }
    
    // Hide any overlays and show game over
    hideScreen('transition-screen');
    hideScreen('countdown-321-screen');
    hideScreen('battle-screen');
    hideScreen('result-screen');
    hideScreen('game-screen');
    
    // Play winner sound
    const winnerSound = document.getElementById('winner-sound');
    if (winnerSound) {
        winnerSound.currentTime = 0;
        winnerSound.volume = 1.0;
        winnerSound.play().catch(err => console.log('Winner sound blocked:', err));
    }
    
    // Clone header into gameover screen
    cloneGameHeader('gameover-header');
    
    // Force display for gameover screen
    const gameoverScreen = document.getElementById('gameover-screen');
    gameoverScreen.style.display = 'flex';
    gameoverScreen.classList.add('active');
    console.log('Gameover screen should now be visible');
}

function resetGame() {
    // Always redirect to student dashboard
    window.location.href = 'student-dashboard.html';
}

// ========================================
// UI HELPERS
// ========================================

function showScreen(screenId, asOverlay = false) {
    const screen = document.getElementById(screenId);
    if (screen) {
        // If not showing as overlay, hide all non-overlay screens first
        if (!asOverlay) {
            document.querySelectorAll('.screen:not(.overlay)').forEach(s => {
                s.classList.remove('active');
            });
        }
        screen.classList.add('active');
        if (asOverlay) {
            screen.style.display = 'flex';
        }
    }
}

function hideScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('active');
        if (screen.classList.contains('overlay')) {
            screen.style.display = 'none';
        }
    }
}

function showMessage(msg) {
    // Simple alert for now - could be replaced with custom modal
    console.log(msg);
}

// ========================================
// DEBUG / DEMO FUNCTIONS
// ========================================

// For testing - quick game with preset cards
function debugStartGame() {
    document.getElementById('player1-name').value = 'Alice';
    document.getElementById('player2-name').value = 'Bob';
    
    GameState.players[1].cards = [1, 2, 3, 3, 5];
    GameState.players[2].cards = [1, 2, 2, 4, 5];
    
    // Bypass random generation
    const originalGenerate = generateRandomCards;
    generateRandomCards = (count) => {
        generateRandomCards = originalGenerate;
        return GameState.players[GameState.currentPlayer === 1 ? 1 : 2].cards;
    };
    
    startGame();
}

// Expose for console debugging
window.GameState = GameState;
window.debugStartGame = debugStartGame;

// ========================================
// CARD POPUPS (RIGHT-CLICK)
// ========================================

function initCardPopups() {
    const popup5Overlay = document.getElementById('card5-popup-overlay');
    const popup4Overlay = document.getElementById('card4-popup-overlay');
    const popup3Overlay = document.getElementById('card3-popup-overlay');
    const popup2Overlay = document.getElementById('card2-popup-overlay');
    const popup1Overlay = document.getElementById('card1-popup-overlay');
    
    // Right-click handler for special cards
    document.addEventListener('contextmenu', function(e) {
        const card5Element = e.target.closest('.card-special-5');
        const card4Element = e.target.closest('.card-special-4');
        const card3Element = e.target.closest('.card-special-3');
        const card2Element = e.target.closest('.card-special-2');
        const card1Element = e.target.closest('.card-special-1');
        
        if (card5Element) {
            e.preventDefault();
            showCardPopup(5);
        } else if (card4Element) {
            e.preventDefault();
            showCardPopup(4);
        } else if (card3Element) {
            e.preventDefault();
            showCardPopup(3);
        } else if (card2Element) {
            e.preventDefault();
            showCardPopup(2);
        } else if (card1Element) {
            e.preventDefault();
            showCardPopup(1);
        }
    });
    
    // Close popup when clicking outside the card content and badges
    popup5Overlay.addEventListener('click', function(e) {
        const content = e.target.closest('.popup-card-container');
        const badge = e.target.closest('.popup-badge');
        if (!content && !badge) {
            hideCardPopup(5);
        }
    });
    
    popup4Overlay.addEventListener('click', function(e) {
        const content = e.target.closest('.popup-card-container');
        const badge = e.target.closest('.popup-badge');
        if (!content && !badge) {
            hideCardPopup(4);
        }
    });
    
    popup3Overlay.addEventListener('click', function(e) {
        const content = e.target.closest('.popup-card-container');
        const badge = e.target.closest('.popup-badge');
        if (!content && !badge) {
            hideCardPopup(3);
        }
    });
    
    popup2Overlay.addEventListener('click', function(e) {
        const content = e.target.closest('.popup-card-container');
        const badge = e.target.closest('.popup-badge');
        if (!content && !badge) {
            hideCardPopup(2);
        }
    });
    
    popup1Overlay.addEventListener('click', function(e) {
        const content = e.target.closest('.popup-card-container');
        const badge = e.target.closest('.popup-badge');
        if (!content && !badge) {
            hideCardPopup(1);
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (!popup5Overlay.classList.contains('hidden')) {
                hideCardPopup(5);
            }
            if (!popup4Overlay.classList.contains('hidden')) {
                hideCardPopup(4);
            }
            if (!popup3Overlay.classList.contains('hidden')) {
                hideCardPopup(3);
            }
            if (!popup2Overlay.classList.contains('hidden')) {
                hideCardPopup(2);
            }
            if (!popup1Overlay.classList.contains('hidden')) {
                hideCardPopup(1);
            }
        }
    });
}

function showCardPopup(cardLevel) {
    const popupOverlay = document.getElementById(`card${cardLevel}-popup-overlay`);
    if (popupOverlay) {
        popupOverlay.classList.remove('hidden');
    }
}

function hideCardPopup(cardLevel) {
    const popupOverlay = document.getElementById(`card${cardLevel}-popup-overlay`);
    if (popupOverlay) {
        popupOverlay.classList.add('hidden');
    }
}

// Initialize popups on page load
document.addEventListener('DOMContentLoaded', initCardPopups);
