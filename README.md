# XO.GAME - Modern Multiplayer Tic Tac Toe

![XO Game](https://xogame-94c8b.web.app/preview.png)

A modern and interactive real-time multiplayer Tic Tac Toe game with Firebase integration. Play with friends from anywhere in the world with our sleek, responsive interface and innovative gameplay modes!

## 🎮 Game Features

* **Modern UI:** Clean, responsive design with smooth animations
* **Multiplayer:** Real-time gameplay with friends using shareable room codes
* **Tactical Strike Mode:** Enhanced gameplay with special moves and abilities:
  * **Strike:** Standard symbol placement
  * **Defend:** Shield mode to protect squares
  * **Sacrifice:** Trade symbols for tactical advantages
* **Power Tiles:** Special tiles with unique abilities (bomb, swap, lock)
* **Game Modes:**
  * **Blitz Mode:** 10-second timer for quick decisions
  * **Gambit Mode:** Bet on your skills with in-game currency
* **Dark/Light Mode:** Toggle between color schemes
* **Chat System:** Built-in text and voice chat with other players
* **Ready System:** Players must ready up before the game starts

## 🚀 How to Play

1. Enter your name
2. Select game mode (Classic or Tactical Strike)
3. Create a new game and share your room code with a friend OR join an existing game with a room code
4. Both players mark themselves as ready
5. The creator starts the game after a countdown
6. Take turns placing your symbol (X or O) on the board
7. First player to get 3 in a row (horizontally, vertically, or diagonally) wins!

## 💻 Technologies Used

* HTML5, CSS3, JavaScript
* Firebase Realtime Database
* WebRTC for voice chat
* Font Awesome icons

## 🔄 Auto-Update Script

This project includes an automatic GitHub updater script (`update_github.bat`) that makes it easy to keep your repository up to date.

### How to Use the Updater:

1. Simply double-click the `update_github.bat` file
2. The script will:
   * Check if Git is installed
   * Initialize a Git repository if needed
   * Add all changed files (except itself)
   * Commit changes with a timestamped message (or custom message)
   * Push changes to GitHub

### Features of the Updater:

* Automatically excludes itself from uploads
* Creates and maintains .gitignore file
* Provides update timestamps
* Allows custom commit messages
* Handles all Git commands automatically

## 🛠️ Setup and Deploy

1. Clone this repository
2. Set up a Firebase project with Realtime Database
3. Update the Firebase configuration in `firebase-config.js`
4. Deploy to Firebase Hosting

### Firebase Hosting Quick Deploy

```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize your project
firebase init

# Deploy to Firebase
firebase deploy
```

## 🎯 Future Enhancements

* Player profiles and statistics
* Tournament mode
* Spectator mode
* Achievements system
* More power tiles and abilities

## ⚖️ License

MIT License

## 👤 Author

Created by @el4abdu 