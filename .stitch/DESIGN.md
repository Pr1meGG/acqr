# ACQR Design System & UX Spec

## 1. UI/UX Specification (Phase 1)
**Goal:** A fast developer tool UI that shows code issues clearly, allows instant fixes, and avoids clutter. (VS Code + Linear + Raycast hybrid).

### Layout Hierarchy
*   **Left (60%):** Code Editor Pane. Distraction-free, dark-themed Monaco editor.
*   **Right (40%):** Analysis Pane. Scannable issue list, grouped by line number, ordered by severity.
*   **Bottom (200px):** Console Output. Live terminal execution feedback.

### Interaction Model (Keyboard-First)
*   **Navigation:** `Alt + ↑` and `Alt + ↓` to instantly jump between issues without losing editor focus.
*   **Action:** `Ctrl + Enter` to apply the instant fix for the active issue.
*   **Synchronization:** Editor automatically centers and focuses on the active issue line.

### UX Priorities
1.  **Speed over Context:** Issues are understood in <2 seconds. Boilerplate text is stripped.
2.  **Action over Reading:** Instant fixes are displayed as single-line diffs natively in the collapsed card.
3.  **Severity Parsing:** Colors and borders guide the eye instantly to critical failures.

---

## 2. Design Tokens (Phase 2 & 3)

### Color Palette (Layered Dark)
*   **Base Canvas:** `#020617` (Deepest slate, replaces black)
*   **Surface:** `#0F172A` (Elevated panel backgrounds)
*   **Border:** `#1E293B` (Subtle structural dividers)
*   **Text (Primary):** `#F8FAFC`
*   **Text (Muted):** `#94A3B8`

### Semantic Colors
*   **Error (Red):** `#EF4444` - Used for syntax/runtime failures.
*   **Warning (Yellow):** `#F59E0B` - Used for heuristics/style issues.
*   **Info (Blue):** `#3B82F6` - Used for optimizations.
*   **Success (Green):** `#10B981` - Used for diff additions and empty states.

### Typography
*   **UI/Structural:** `Inter`
*   **Labels/Metadata:** `Space Grotesk` (Line numbers, confidence badges)
*   **Code:** `JetBrains Mono`

### Spacing (4px Baseline)
*   `xs`: 4px
*   `sm`: 8px
*   `md`: 16px
*   `lg`: 24px
*   `xl`: 48px

---

## 3. Iterative Refinements (Phase 4)
*   *Iteration 1:* Grouped duplicated backend issues by line number to prevent card spam.
*   *Iteration 2:* Mapped severity to left-borders (3px) and background tints (5% opacity) to eliminate the need to read headers to know issue criticality.
*   *Iteration 3:* Compressed AI explanations. Defaulted to collapsed. Stripped AI filler words ("The statement on line X..."). Pulled simple 1-line fixes directly into the unexpanded card view to achieve 0-click understanding.
