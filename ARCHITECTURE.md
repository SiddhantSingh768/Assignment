# 🏗️ Architecture Note

This document outlines the architecture, data models, and system flows of the **Collaborative Document Editor**. The application is designed as a robust full-stack solution utilizing **React/Vite** for the client application and a **Node.js/Express** server for secure routing and session handling.

---

## 🗺️ System Overview

The application architecture follows a standard client-server pattern optimized for high responsiveness and local-first preview fidelity:

```
+------------------------------------------+
|                 CLIENT                   |
|  - React 18 / Tailwind CSS / Lucide      |
|  - ContentEditable rich-text canvas      |
|  - Autosave manager (3s debounced)       |
+-------------------+----------------------+
                    | HTTP REST API
                    v
+-------------------+----------------------+
|                 SERVER                   |
|  - Express.js router                     |
|  - Bearer Token Session Middleware       |
|  - Static content build engine           |
+-------------------+----------------------+
                    | Direct Data Hooks
                    v
+-------------------+----------------------+
|             DATA LAYER                   |
|  - In-Memory Structured Mock Database    |
|  - Cryptographic password hashing        |
|  - Cascade deletion on document removal  |
+------------------------------------------+
```

---

## 🔒 Security & Session Workflows

### 1. Token-Based Authentication
- Sessions are completely stateless on the client-side.
- Upon successful validation of credentials via `/api/login`, the server generates a cryptographically secure token prefix (`token_...`) using `crypto.randomBytes`.
- This token is saved in client `localStorage` and sent in the HTTP `Authorization` header as a `Bearer` token on subsequent operations.
- The Express server acts as the gateway via custom `authenticate` middleware, matching incoming tokens against an in-memory session ledger (`activeSessions`).

### 2. Authorization & Access Rules
All document endpoints enforce granular access control rules matching the owner schema:
- **Read Access:** Granted if the current user ID is the document's `ownerId` OR if an access record exists in the sharing ledger for this document.
- **Edit Access:** Granted if the user is the owner OR if their permission level matches `'edit'`.
- **Manage Access / Share:** Restricted exclusively to the document's original owner (`ownerId`).
- **Deletion:** Only the document's `ownerId` can perform the destructive deletion process. When deleted, all shared references are immediately cascade-deleted from the sharing registry to prevent orphan shares.

---

## 🗄️ Core Database Schemas

The data layer mimics a relational model, fully prepared to be swapped for **PostgreSQL/Firestore** schemas with no modifications to endpoint signatures:

### 1. Users (`users` collection)
```typescript
interface User {
  id: string;          // Cryptographically unique identifier
  name: string;        // Human readable profile name
  email: string;       // Unique, sanitized login key
  passwordHash: string;// SHA-256 salted credentials hash
}
```

### 2. Documents (`documents` collection)
```typescript
interface Document {
  id: string;          // Unique document ID
  title: string;       // Title of the doc (max 100 characters)
  content: string;     // Sanitize-ready HTML/text contents
  ownerId: string;     // ID linking to the original creator
  createdAt: string;   // Creation timestamp ISO
  updatedAt: string;   // Modified timestamp ISO
}
```

### 3. Share Permissions (`sharing` collection)
```typescript
interface Share {
  documentId: string;  // Target document pointer
  userId: string;      // Collaborator's target user ID
  permission: 'edit';  // Active permission role
}
```

---

## ⚡ Key Optimizations

- **Debounced Autosave Engine:** Avoids flooding the server and database by using a `2500ms` debounce timer on the editor `onInput` event. If another keypress is registered before the timer ends, the previous save is cancelled.
- **Immediate Manual Override:** Users can force-save instantly at any time via the "Save Now" header button, bypassing the debounce timer.
- **Direct Workspace Updates:** Local document states update immediately upon a successful save without refetching the entire workspace array from the network.
- **Rich-Text Command Delivery:** Employs standard browser text execution commands (`document.execCommand`) to render formatted paragraphs, headings, bold elements, italic ranges, and ordered/unordered lists with lightweight footprint.
