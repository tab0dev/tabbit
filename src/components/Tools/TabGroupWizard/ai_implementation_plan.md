# AI Grouping Optimization & Evaluation Framework

This plan addresses the AI grouping performance latency and establishes a robust prompt evaluation framework, incorporating the constraints and approvals from the AI Code Review feedback.

## Proposed Changes

### 1. Model Latency & Token Optimization
We will refactor the input processing and prompt constraints to accommodate the limitations of local on-device LLMs without changing the fundamental lifecycle.

#### [MODIFY] `src/services/aiGroupingService.js`
- **Output Token Optimization (Ditch JSON):**
  - Change `SYSTEM_PROMPT` to instruct the model to output a dense, plaintext format: e.g., `GroupName: 1, 2, 3`.
  - Remove the `responseConstraint` schema.
  - Implement a simple regex parser (`/^(.+):\s*([\d,\s]+)$/gm`) to parse the output and map indices back to tabs.
- **Input Token Waste Reduction:**
  - Slice `tab.title` to 65 characters max to remove SEO bloat.
  - Remove trailing slashes and clean `tab.path` via safe string processing.
- **Granular Progress Reporting:**
  - Update `suggestGroups` to accept an `onPhaseChange` callback to report exactly what the AI is doing (`initializing`, `inferencing`, `parsing`).

### 2. UI Granular Loading States
Instead of hiding the loading time, we will make the UI highly communicative about what stage of the LLM pipeline is currently running.

#### [MODIFY] `src/components/Dashboard/AutoTabGroupWizard/useWizardAi.js`
- Add an `aiPhase` state (`initializing`, `inferencing`, `parsing`).
- Pass the `onPhaseChange` callback down into `suggestGroups`.

#### [MODIFY] `src/components/Dashboard/AutoTabGroupWizard.jsx`
- Update the AI loading overlay. Instead of just "AI is analyzing tabs… this may take a few seconds", dynamically update the text based on the `aiPhase`:
  - `initializing`: "Loading AI session into memory..."
  - `inferencing`: "AI is analyzing tabs..."
  - `parsing`: "Parsing results..."

### 3. AI Evaluation Suite
To test prompt robustness and consistency without manual application usage, we will create a standalone evaluation suite.

#### [NEW] `src/services/aiEvaluationSuite.js`
- Create predefined dummy tab datasets representing various user intents (e.g., "Buying a watch", "Job hunting", "Random mixed tabs").
- Implement an `evaluatePrompt()` function that iterates over the datasets, calls `suggestGroups()` for each, and measures latency.
- Output a beautifully formatted table to the browser console showing the Results, Expected Groups, Latency, and any orphan tabs.
- Expose this suite globally in development mode (e.g., `window.runAiEvaluation()`) so you can run it anytime from the DevTools console.

## Verification Plan
1. Trigger `window.runAiEvaluation()` in the console and ensure the regex accurately parses plaintext LLM responses.
2. Open the UI, click "AI Mode", and verify that the loading overlay accurately transitions through "Loading AI session...", "AI is analyzing...", and "Parsing results...".
