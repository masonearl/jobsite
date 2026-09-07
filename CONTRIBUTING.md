# Contributing to Jobsite

Start by running the game locally and reading the relevant file. The frontend is vanilla HTML/CSS/JavaScript; Three.js is vendored for rendering. Keep changes focused and avoid adding build tooling or dependencies without a clear need.

## Report a gameplay issue

Include the browser/device, region and equipment spread, the actions you took, what happened, and what you expected. A short recording or screenshot helps with camera, bucket, and trench problems. Never include private project data or credentials.

## Submit a change

1. Create a branch on your fork.
2. Make one focused change. Explain the problem and resulting behavior.
3. Run `npm test` for simulation changes. Add meaningful checks for movement, material conservation, progression, or other behavior that changes.
4. For visual/input changes, test the game in a browser at desktop and phone sizes. Check press/hold/release, pause, and expanded view.
5. Include a screenshot or short recording for visible changes.

Use plain field language in the UI. Do not add decorative Unicode or emoji. Preserve keyboard and touch controls. Treat regional values as simulation presets; explain any construction assumptions and cite sources when introducing factual learning content.

Keep asset licenses and attribution. Do not submit third-party models or textures without permission to redistribute them under compatible terms.
