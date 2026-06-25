# Changelog

All notable changes to the Class Boss Battle project are documented in this file.

## [1.1.0] - Production Ready Update
### Added
- **Generated Custom Assets**: 3 Custom boss images (Dragon, Robot, Slime), 8 custom avatars for students, and an immersive arena background, eliminating reliance on emoji or placeholder graphics.
- **Enhanced Procedural Audio**: Completely rewrote the `AudioEngine` to use multi-oscillator polyphonic synthesizers via Web Audio API. Background music now features chords, bass lines, and melodies. Sound effects like "Hit", "Correct", and "Victory" are much punchier and dynamic.
- **Victory Confetti**: A colorful CSS animation confetti drops dynamically when a boss is defeated.
- **Questions Bank Module**: Separated the hardcoded questions out of `script.js` into an ES module `questions.js` for easier updates by teachers.
- **Explanation Feedback**: When students answer a question, they now see the explanation of the correct answer directly under the feedback banner.

### Changed
- **UI Enhancements**: Glassmorphism UI now has better contrast with a darkened overlay on the arena background, and boss hit animations are improved with scaling and critical flash effects.
- **Avatar Selection**: Replaced standard emojis with fully custom generated avatar images displayed in the real-time leaderboard.

### Security
- **Firebase Rules**: Code audited to guarantee robust isolation for concurrent players relying entirely on derived state updates.

## [1.0.0] - Initial Prototype
- Basic realtime battle features (create room, join room, damage tracking, sync).
