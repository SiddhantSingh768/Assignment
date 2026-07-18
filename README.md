# 📝 Collaborative Document Editor

An elegant, lightweight, full-stack collaborative document management workspace that enables users to create, format, import, organize, and securely share rich-text documents with peers. 

This repository implements the complete requirements specified in the Product Requirements Document (PRD), focusing on pristine full-stack architecture, absolute type safety, automated API verification, and responsive mobile-first UI design.

---

## 🚀 Local Setup & Run Instructions

Follow these steps to configure and run the full-stack Collaborative Document Editor locally.

### 📋 Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)

### 🔧 Installation

1. **Clone the project & Navigate to the workspace:**
   ```bash
   cd collaborative-document-editor
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file at the root of the project using `.env.example` as a template:
   ```env
   # .env
   GEMINI_API_KEY="your_actual_gemini_api_key_here"
   APP_URL="http://localhost:3000"
   ```

### ⚙️ Executing the Application

- **Run in Development Mode:**
  Launches the Node/Express backend and Vite development middleware concurrently:
  ```bash
  npm run dev
  ```
  Once active, open [http://localhost:3000](http://localhost:3000) in your web browser.

- **Run Automated Tests:**
  Execute the custom test suite covering Document CRUD operations, sharing permissions, and database operations:
  ```bash
  npm run test
  ```

- **Compile and Build for Production:**
  Transpiles the React frontend static pages and compiles the Express backend server:
  ```bash
  npm run build
  ```

- **Start Production Server:**
  Starts the compiled high-efficiency production build:
  ```bash
  npm run start
  ```

---

## 👥 Seeded Accounts for Evaluation

For rapid verification, evaluation, and reviewer sign-in, the following credentials have been fully seeded in the local database. Click on any block in the login workspace to pre-fill instantly:

| Name | Email Address | Password | Role / Account Type |
| :--- | :--- | :--- | :--- |
| **Alice Smith** | `alice@example.com` | `password123` | Document Owner / Collaborator |
| **Bob Jones** | `bob@example.com` | `password123` | Reviewer Persona |
| **Siddhant Singh** | `siddhant@example.com` | `password123` | Developer Persona |
| **Reviewer Account** | `reviewer@example.com` | `password123` | External Auditor |

---

## 🛠️ Tech Stack & Dependencies

- **Frontend:** React, TypeScript, Tailwind CSS, Lucide Icons, Motion (Animations)
- **Backend:** Node.js, Express, tsx
- **Storage:** File-based JSON Database matching SQL structures
- **Validation:** Type-safe JSON schemas, Regex and extension validators
- **Testing:** Native Node Assert test framework

---

Enjoy writing and collaborating on **ShareDoc.io**! 🌌
"# Assignment" 
"# Assignment" 
