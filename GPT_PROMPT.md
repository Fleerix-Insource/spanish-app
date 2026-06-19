# GPT-5.5 X-High Thinking — Fix & Overhaul Spanish Learning App

## Context
This is a single-page Spanish learning web app (vanilla JS, HTML, CSS) with a 150-day curriculum. It uses localStorage for persistence, Web Speech API for audio, and Web Audio API for SFX. The app is at `C:\Users\NITRO5\source\repos\spanish-app\`. Key files:
- `app.js` (1757 lines) — state management, exercise generation, rendering, lesson flow, checkpoint system, feedback, flashcards, vocab browser, stats, badges, quests, export/import
- `curriculum.js` (very large) — 150 days of lessons across 5 phases, each with grammar HTML, vocab lists, exercise items, and 5 checkpoint blocks with multiple-choice questions
- `index.html` (22 lines) — bare shell, loads curriculum.js then app.js
- `style.css` (338 lines) — Duolingo-inspired dark/light theme
- `sw.js` — service worker for offline
- `manifest.json` — PWA manifest

## Your Task
Analyze and fix EVERYTHING that needs improvement. Be exhaustive. Use thinking capability X-high. Cover:

### 1. Security Vulnerabilities
- XSS: innerHTML is used everywhere with user-influenced data (search input, exported JSON on import, vocab display). Any exercise with user text that gets rendered could be exploited.
- Prototype pollution / localStorage tampering: state is JSON.parsed from localStorage with minimal validation.
- Import function reads arbitrary JSON and replaces state with zero validation.
- Speech synthesis could be abused.

### 2. Bugs & Logic Errors
- **Heart refill system**: `refillHearts()` is called in `renderPath()` but not during lessons. Hearts lost in a lesson aren't refilled until user goes back to path. The timer logic using `lastHeartRefill` has race conditions and doesn't properly track partial refills across sessions.
- **Normalize function**: Stripping diacritics is overly aggressive — `normalize()` should handle ñ vs n, accented vowels, inverted punctuation, etc. properly.
- **Match exercise bug**: If user matches all pairs correctly, `lesson.answered = true` is set but `showCorrectFeedback` is called. However, `nextQuestion` flow doesn't advance until continue button clicked. But if the user never clicks the last item (they could leave), there's no guard.
- **Keyboard shortcut cleanup**: The keydown listener only removes itself after 5s, but if a question takes longer than 5s the old listener persists and can fire twice.
- **Badge `checkpoint` always earns**: Line 134 `if (b.id === 'checkpoint') earn = true;` is unconditional — it gives the checkpoint badge every time `checkBadges()` runs, not just when a checkpoint is actually passed.
- **Badge `perfect_lesson`**: Only awarded when the lesson is new (`isNew`), so reviewing a completed lesson can never earn the perfect badge. But lessons can be "reviewed" (re-completed with no mistakes) and should still count.
- **Daily quest progress**: `q_no_mistakes` quest uses `done:() => 0` so can never complete.
- **`genComplete` exercise**: Uses `items` from curriculum's `exercise[].items[]` but many curriculum days have 0 items defined, so it falls back to vocab. The slot-filling logic picks the middle word blindly which can be a function word or article.
- **`isUnlocked` logic**: For checkpoint days, it checks all non-checkpoint phase days are completed. But for regular days, it just checks `isCompleted(day - 1)`. If a checkpoint was passed (day 30), day 31 needs day 30 completed but day 30's isUnlocked requires ALL phase 1 days completed first. This could create an unlock cascade issue if phase 1 has incomplete days after the checkpoint.
- **Streak logic**: `updateStreak()` is only called on first completion of a lesson (`finishLesson` when `isNew`). Subsequent completions (reviewing) don't update streak. Streak should be based on any daily activity.
- **`words_100` and `words_500` badges**: They check `state.totalCorrect >= N`, not `state.wordsLearned` or actual unique words learned. This conflates total answer count with vocabulary size.
- **Export/Import**: The import button creates a file input on every click but never removes it from DOM—zombie elements accumulate.
- **`showCorrectFeedback` for match exercises**: When match completes, `showCorrectFeedback` is called but `checkAnswer` was not called before it, so there's no XP addition path through `checkAnswer` for match. The XP is added inline in the match handler (line 1099-1100), but `showCorrectFeedback` doesn't re-add. However `trackCorrect` is never called for match exercises, so the stats are incomplete.
- **`genTranslate` vs `genChoiceEnToEs`**: These can generate duplicate exercises since both operate on the same vocab pool independently.
- **Listen exercise auto-play**: If the user navigates away or the lesson ends before the 400ms timeout fires, `speak` may still execute.
- **CSS `.choice-btn.correct` and `.incorrect` use `!important`**: Overly aggressive, breaks hover states if user clicks rapidly.
- **`trackCorrect` function is empty** (line 87-92): It checks for failed concepts but never actually removes them from `state.failedConcepts` when a word is later answered correctly.
- **`scheduleReview` and `getDueReviews`**: `dueReview` is keyed by day number. `scheduleReview` pushes the same word multiple times if failed in multiple exercises. Reviews are never marked as completed or removed from the queue.
- **Weak words menu count** shows `state.failedConcepts.length` but doesn't deduplicate.
- **Memory leaks**: Event listeners on `#langToggle` and `#themeBtn` in `renderQuestion()` are re-created on every render but old ones are never removed. The `document.addEventListener('keydown', keyHandler)` also leaks after 5s if not cleaned properly.

### 3. Curriculum & Pedagogy Issues
- **No voseo coverage**: Voseo is used in Argentina, Uruguay, Paraguay, Central America, parts of Colombia/Venezuela. The app completely ignores it.
- **No vosotros practice**: Vosotros is included in tables but never tested in exercises.
- **Grammar explanations are too text-heavy**: Walls of HTML tables with no visual hierarchy or interactive elements.
- **No reading comprehension exercises**: Only translation, fill-in-blank, match, listen. No passages to read and answer questions about.
- **No listening-first exercises**: All listen exercises require typing. No "hear and choose" (listen then select from options) which is more beginner-friendly.
- **No speaking exercises**: No speech recognition or pronunciation practice.
- **Phase 1 is 30 days of pure foundation grammar**: Days 1-30 cover pronouns, ser, articles, adjectives, tener, regular verbs, questions, negatives, numbers, prepositions. But learners get zero "real" language production until day 20. This is too slow.
- **Vocabulary selection issues**: Some word themes are arbitrary. "Phase 1 Review" vocab includes meta-words like "concepto", "repasar", "combinar" that are not high-frequency. Many days have filler vocab that doesn't align with the grammar topic.
- **No false friend warnings**: No coverage of common false cognates (embarazada, actualmente, constipado, etc.).
- **No regional variation**: No mention of differences between Spain vs Latin American Spanish (coger, vosotros, vos, etc.).
- **Checkpoint questions are too easy**: Only multiple choice, no production. A real checkpoint should include a mix.
- **No cultural content**: Zero cultural notes about Spanish-speaking countries, traditions, etc.
- **Exercise variety is limited**: Only 6 types (choice x2, translate, complete, listen, match). No ordering exercises, no sentence unscrambling, no dialogue completion, no image-based exercises.
- **Grammar progression could be better**: The preterite (past tense) is introduced in Phase 3 (day 90+) which is far too late for real communication. Learners in Phase 1 can only speak about the present.
- **No "chunk" or "phrase" learning**: The app teaches word-by-word but doesn't teach common sentence starters, conversation gambits, or fixed expressions that are the backbone of fluency.
- **Consistency check**: Some curriculum entries use `<br>` inside `<b>` tags, sometimes self-closing is inconsistent. HTML entities vs actual Unicode characters are mixed (e.g., `\u00e9` vs `&eacute;`).

### 4. Learning Strategy Improvements
- **No adaptive difficulty**: Every learner gets the same exercises regardless of performance. Should use the `failedConcepts` array to push more questions on weak areas.
- **Spaced repetition is very primitive**: `scheduleReview` just dumps words into a flat queue. No SM-2 algorithm, no intervals, no ease factors, no graduation.
- **No review mode**: Once a lesson is completed, "review" just re-shows the same exercises verbatim. There should be a quick-review mode (flashcards or 3-question quiz for each completed day).
- **No mixed review**: No cross-day review that pulls words from various previous days.
- **Feedback is too shallow**: "Correct" / "Incorrect" with an explain toggle. Should auto-show the explanation on first incorrect attempt, with more detailed grammar breakdowns.
- **No writing correction**: The translate exercises accept exact match with normalization. They don't provide feedback on partial matches, typos, or close answers.
- **Gamification is shallow**: Streak, XP, hearts, gems, badges exist but there's no leaderboard, no goals, no level progression beyond phase names.
- **Hearts system is punitive**: Losing hearts on every mistake with a 30-minute refill for one heart means casual learners hit a wall quickly. Better: lose hearts only after multiple mistakes in a row, or have unlimited practice mode.
- **No goals or milestone tracking**: No way for user to set a daily goal (e.g., "earn 50 XP today") or see their weekly activity.
- **Session metrics**: No "time spent learning" tracking, no "words reviewed this session" counter.
- **No notification system**: No way to remind users to return when hearts are full or when reviews are due.
- **Long-term retention tracking**: No way to see which words are at risk of being forgotten (beyond `failedConcepts` which is just error count).

### 5. Code Smells & Technical Debt
- `innerHTML` used everywhere instead of DOM API — massive XSS vector, no escaping
- `getDayData(day)` is O(n) per call, called in loops
- No modularization — everything is global, functions reference each other in fragile order
- Magic numbers everywhere (XP_PER_CORRECT = 10, etc.) — good these are constants, but lots of hardcoded values in the curriculum
- `state.useSpanish` toggle is a global flag that changes function scope — confusing
- No error handling around localStorage (quota exceeded, private browsing modes)
- `curriculum.js` is 5000+ lines of raw JS object data — should be JSON
- Exercise generation is tightly coupled to rendering
- No automated tests
- No build step, no bundler
- `speak()` promise is never awaited properly in most call sites
- Audio context may be blocked by browser autoplay policy but never handles this gracefully

## Deliverable
Output the COMPLETE FIXED versions of ALL files: `app.js`, `curriculum.js`, `style.css`, `index.html`, `sw.js`, `manifest.json`, `icon.svg`.

For each file, explain the key changes made. For security fixes, explain the vulnerability and mitigation. For bugs, explain the root cause and fix. For curriculum/strategy changes, explain the pedagogical rationale.

Be exhaustive. Fix everything. Make this app production-quality.
