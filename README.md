# Español 150

Learn Spanish from A0 to B1/B2 with 150 days of structured lessons.

A standalone, client-side Progressive Web App (PWA) for learning Spanish — inspired by Duolingo. Built entirely with vanilla JavaScript, HTML, and CSS. No frameworks, no build tools, no dependencies.

## Features

- **150-day curriculum** across 5 phases (Foundation, Present, Past, Future & Complex, Conversation)
- **Exercise types**: Multiple choice, translation, sentence completion, listening comprehension, matching pairs
- **Checkpoint assessments** every 30 days to test cumulative knowledge
- **XP & Hearts system** — earn XP for correct answers, manage lives with a heart refill system
- **Streaks** — daily streak tracking with motivational messages
- **Badges** — 12 achievement badges to unlock
- **Daily quests** — randomized quests with XP rewards
- **Spaced repetition** — review incorrectly answered concepts with re-quizzing
- **"Explain My Answer"** — detailed grammar explanations with examples (Duolingo-style)
- **Flashcards & Weak Words** — browse unlocked vocabulary, review frequently missed words
- **Statistics** — accuracy, streak, XP, gems, lessons completed, words learned
- **Audio** — built-in text-to-speech for Spanish pronunciation (Web Speech API)
- **Dark/Light mode** — toggleable theme
- **EN/ES interface** — bilingual UI toggle
- **Progress export/import** — save and restore progress as JSON
- **Offline support** — service worker caches all assets
- **Installable PWA** — add to home screen on supported browsers

## How to Run

Since this is a pure client-side app with no dependencies, simply open `index.html` in any modern browser.

For the best experience (especially audio/SpeechSynthesis), serve it via a static HTTP server:

```bash
# Python
python -m http.server 8000

# or Node.js
npx serve .
```

Then navigate to `http://localhost:8000`.

## Curriculum

| Phase | Days | Focus |
|-------|------|-------|
| 1 | 1–30 | Fundamentos (Foundation) |
| 2 | 31–60 | Presente (Present) |
| 3 | 61–90 | Pasado (Past) |
| 4 | 91–120 | Futuro y Complejo (Future & Complex) |
| 5 | 121–150 | Conversación (Conversation) |

## Tech Stack

- Vanilla JavaScript (ES6+)
- HTML5 / CSS3
- Web Speech API (text-to-speech)
- Web Audio API (sound effects)
- Service Worker API (offline caching)
- localStorage (persistence)

## License

MIT
