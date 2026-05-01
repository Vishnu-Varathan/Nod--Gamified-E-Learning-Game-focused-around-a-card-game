# ⚔️ Card Battle - Game Based Learning System HAHAHAHA 

A real-time multiplayer card battle game built with Firebase for live updates.

## 🎮 Game Rules

1. **Setup**: Each player starts with 5 randomly generated cards (values 1-5)
2. **Turns**: Players take turns playing cards
3. **Battle**: When both players have played, cards are revealed
4. **Win Condition**: Higher card value wins and captures the opponent's card
5. **Stalemate**: If cards are equal, both are returned but cannot be played next round
6. **Cooldown**: Cards just played cannot be played in the immediately following turn
7. **Scoring**: Score = Sum of all card values you own
8. **Timer**: Game lasts (number of cards × 2) minutes = 10 minutes for 5 cards
9. **Game Over**: When timer runs out or a player has no cards left

## 🚀 Quick Start (Demo Mode)

The game works immediately without Firebase setup:

1. Open `index.html` in a web browser
2. Enter player names
3. Click "START BATTLE"
4. Play! The game runs in demo mode locally

## 🔥 Firebase Setup (For Real-time Features)

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** or **"Add project"**
3. Enter project name: `CardBattleGame`
4. Enable/Disable Google Analytics (optional)
5. Click **"Create project"**

### Step 2: Add Web App

1. Once the project is created, click the **Web icon** (`</>`) on the project overview page
2. Register your app with a nickname: `Card Battle Web`
3. **DO NOT** check "Also set up Firebase Hosting" for now
4. Click **"Register app"**
5. You'll see a config object - **KEEP THIS PAGE OPEN**

### Step 3: Set Up Realtime Database

1. In the Firebase Console sidebar, go to **Build** → **Realtime Database**
2. Click **"Create Database"**
3. Choose your database location (select the closest to your users)
4. Select **"Start in test mode"** (for development)
5. Click **"Enable"**

### Step 4: Configure Your App

1. Open `firebase-config.js` in your code editor
2. Find the `firebaseConfig` object (around line 28)
3. Replace the placeholder values with your Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSy.....................",
    authDomain: "cardbattlegame-xxxxx.firebaseapp.com",
    databaseURL: "https://cardbattlegame-xxxxx-default-rtdb.firebaseio.com",
    projectId: "cardbattlegame-xxxxx",
    storageBucket: "cardbattlegame-xxxxx.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

4. Set `DEMO_MODE = false;` (around line 36)
5. Save the file

### Step 5: Database Security Rules (Production)

For production, update your Firebase Realtime Database rules:

```json
{
  "rules": {
    "games": {
      "$gameId": {
        ".read": true,
        ".write": true
      }
    },
    "leaderboard": {
      ".read": true,
      ".write": true
    }
  }
}
```

> ⚠️ **Note**: Test mode rules expire after 30 days. Update rules before deploying to production.

## 📁 File Structure

```
GameDemo/
├── index.html          # Main HTML structure
├── styles.css          # All styling (themes, cards, animations)
├── firebase-config.js  # Firebase configuration and database functions
├── game.js             # Game logic and state management
└── README.md           # This file
```

## 🎨 Features

- **Player Themes**: Blue (Player 1) and Red (Player 2)
- **Real-time Leaderboard**: Updates instantly when cards are captured
- **Battle Animations**: Dramatic card reveal with countdown
- **Cooldown System**: Visual indicator for cards on cooldown
- **Responsive Design**: Works on various screen sizes
- **Firebase Integration**: Real-time game state synchronization

## 🎯 How Points Work

Your score is the **sum of all card values** you own:

| Player Cards | Calculation | Score |
|--------------|-------------|-------|
| [1, 2, 3, 4, 5] | 1+2+3+4+5 | 15 |
| [5, 5, 5, 5, 5] | 5+5+5+5+5 | 25 |
| [1, 1, 1, 1, 1] | 1+1+1+1+1 | 5 |

**Strategy Tip**: High-value cards are worth more points but also more risky to lose!

## 🔧 Development

### Running Locally

1. Use XAMPP, WAMP, or any local server
2. Place files in `htdocs/GameDemo/`
3. Navigate to `http://localhost/GameDemo/`

Or simply open `index.html` directly in a browser (demo mode).

### Debug Console Commands

Open browser console (F12) and use:

```javascript
// View current game state
console.log(GameState);

// Quick start with preset cards
debugStartGame();
```

## 📝 Customization

### Change Card Count
In `game.js`, modify:
```javascript
settings: {
    cardCount: 5,  // Change number of starting cards
    transitionTime: 5,  // Seconds to pass device
    countdownTime: 3    // Battle countdown seconds
}
```

### Change Card Value Range
In `game.js`, modify the `generateRandomCards` function:
```javascript
cards.push(Math.floor(Math.random() * 10) + 1); // Values 1-10
```

### Change Colors
In `styles.css`, modify the CSS variables:
```css
:root {
    --p1-primary: #1a4a7a;  /* Player 1 blue */
    --p2-primary: #7a1a1a;  /* Player 2 red */
}
```

## 🤝 Two-Player Local Play

This game is designed for **local two-player gameplay**:

1. Player 1 plays their card
2. Screen shows "Pass device to Player 2" with countdown
3. Player 2 plays their card
4. Battle reveal shows both cards
5. Winner takes the lower card
6. Repeat!

## 🌐 Future Enhancements

- [ ] Online multiplayer with room codes
- [ ] Card artwork and character designs
- [ ] Sound effects and music
- [ ] Tournament mode
- [ ] Achievements system
- [ ] Card special abilities

## 📜 License

MIT License - Feel free to use and modify for educational purposes.

---

**Built with ❤️ for Game-Based Learning by THE GOAT = NOD BABYYYY**


