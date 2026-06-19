# Español 150 🇪🇸

A professional, native desktop application for learning Spanish from A0 to B1/B2 with 150 days of structured lessons.

Inspired by Duolingo, this app provides a comprehensive, gamified experience to master Spanish vocabulary, grammar, and pronunciation.

## 🚀 Native App Features

This project has been evolved from a PWA into a **native desktop application** using Electron.js.

- **Native Desktop Wrapper**: No browser address bar or tabs; a focused, standalone experience.
- **Mini-Player Mode**: A "Compact Mode" that optimizes the UI for a small, focused window (420x700), perfect for learning while multitasking.
- **Bidirectional Translation**: Practice both English $\rightarrow$ Spanish and Spanish $\rightarrow$ English to build true fluency.
- **Interactive Hint System**: Get a nudge when stuck with the 💡 Hint button that reveals the first character of the correct answer.
- **Offline-First Architecture**: All assets are cached locally for instant load times.

## 📚 Core Learning Features

- **150-Day Curriculum**: 5 phases covering Foundation, Present, Past, Future/Complex, and Conversation.
- **Diverse Exercise Types**: Multiple choice, bidirectional translation, sentence completion, listening comprehension, and matching pairs.
- **Checkpoint Assessments**: Comprehensive tests every 30 days to validate knowledge before progressing.
- **Gamification**: 
  - **XP & Hearts**: Earn XP for correct answers and manage lives.
  - **Daily Streaks**: Track your consistency with a motivational streak counter.
  - **Combo System**: Earn bonus XP and visual rewards for correct answer streaks.
  - **Badges**: Unlock 12 achievement badges.
- **Intelligent Review**: Spaced repetition system that tracks and re-quizzes "Weak Words" and failed concepts.
- **"Explain My Answer"**: Rich, Duolingo-style grammar cards with conjugation tables, examples, and tips.
- **Interactive Tools**:
  - **Word Bank**: Clickable chips for fast answering.
  - **Flashcards**: Study unlocked vocabulary with audio pronunciation.
  - **Voice Settings**: Choose between Mexican (es-MX) and Castilian (es-ES) accents.
- **Progress Management**: Export and import your progress as a JSON file.

## 🛠️ Tech Stack

- **Core**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Native Wrapper**: Electron.js
- **Audio**: Web Speech API (Text-to-Speech) & Web Audio API (SFX)
- **Persistence**: localStorage
- **Build System**: electron-builder

## ⚙️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS version recommended)

### Installation & Running
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/spanish-app.git
   cd spanish-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm start
   ```

### Building the Installer
To generate a downloadable `.exe` installer for Windows:
```bash
npm run build
```
The installer will be located in the `dist/` folder.

## 🤖 AI Disclosure
This project was developed with the assistance of **opencode (powered by gemma-4-31b-it)**. The AI assisted in:
- Architecture design and Electron.js implementation.
- Bug hunting and logical refinement.
- UI/UX polishing and CSS optimization.
- Curriculum restructuring and content generation.

## 📜 License
MIT
