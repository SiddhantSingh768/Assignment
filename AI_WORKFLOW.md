# 🧠 AI Workflow Note

This document summarizes the **AI-assisted development process** used to design, build, and optimize the **Collaborative Document Editor**. It highlights the engineering decisions, model-driven safeguards, and code compilation cycles that shaped the end product.

---

## 🛠️ Step-by-Step Evolution

The application was built incrementally through a series of model-driven iterations:

### Phase 1: Context Gathering & Planning
- Checked constraints and existing repository boilerplate.
- Designed a **two-way sharing protocol** that does not rely on complex sockets for standard collaboration previews, utilizing standard stateless REST APIs.
- Established rigorous guidelines for user access states and error handling.

### Phase 2: Schema Selection & Core DB Draft
- Initiated a simulated in-memory relational database structure inside `server/db.ts` containing the core entities.
- Generated cryptographically secure passwords and hashed storage using native Node `crypto` algorithms, seeding exactly four realistic user accounts (`Alice`, `Bob`, `Siddhant`, `Reviewer`) to facilitate review workflows.

### Phase 3: Express REST Server Setup
- Created `server.ts` matching standard production port mapping rules (binding exclusively to Port `3000` and host `0.0.0.0`).
- Configured routes for `/api/login`, `/api/me`, `/api/documents`, and `/api/upload`.
- Added strict payload validations:
  - Enforced a maximum `100` character length limit on document and file titles.
  - Added strict suffix checkers restricting file uploads exclusively to plain text (`.txt`) and Markdown (`.md`) extensions.

### Phase 4: Automated Node Integration Testing
- Wrote an automated integration testing suite inside `src/tests/document-creation.test.ts`.
- Integrated `tsx` as a test runner inside `package.json` to enable automated verification.
- Ran test assertions verifying:
  - Seeded users are successfully loaded.
  - Document database creation, retrieval, and updates.
  - Granular sharing controls (Bob can read/write, unauthorized users are denied).
  - Cascade deletions (document deletion cleanly revokes all share records).
- Verified that all unit and integration tests build and execute with a 100% pass rate.

### Phase 5: Client-Side UI & Visual Polish
- Developed the complete, unified workspace app in `src/App.tsx`.
- Handled advanced UI state operations, like:
  - Seamless toggle transitions using `motion`.
  - Automatic formatting converters rendering raw plain-text paragraphs into HTML elements compatible with the browser's rich-text canvas.
  - Dynamic interactive modals for sharing records and importing text files.
  - High-impact CSS visual styles utilizing clean indigo accents, off-white backdrops, balanced negative space, and custom status indicator badges.
- Implemented **User-intent Navigation Fix**: Intercepted header title click events to immediately clear the active document selection, taking the user back to the primary home dashboard effortlessly.

---

## 🛡️ Model Safeguards & Best Practices Applied

1. **Anti-HMR Flickering Design:** Addressed Vite's disabled-HMR limits by storing state variables locally in stable React hooks and using clean element triggers to handle layout animations.
2. **Infinite Re-render Prevention:** Kept `useEffect` dependency arrays focused strictly on primitive values (e.g. `token`, `user`) rather than arrays or functions, ensuring maximum runtime execution safety and zero browser loops.
3. **Pristine Visuals (No Tech-Larping):** Excluded low-value logs, container ports, ping metrics, or diagnostic indicators in the margins to maintain an clean, modern, human-crafted layout.
