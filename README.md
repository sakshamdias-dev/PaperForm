# PaperForm

PaperForm is a powerful, interactive frontend application for designing, editing, and managing educational papers and forms. Built with React and Vite, it offers a rich set of tools including drag-and-drop layout management, rich text editing, math equation support, and direct PDF generation.

## Tech Stack

- **Framework:** React 19, powered by Vite
- **Language:** TypeScript
- **State Management:** Zustand
- **Routing:** React Router DOM
- **Backend & Auth:** Supabase
- **Key Libraries:**
  - **Drag & Drop:** `@dnd-kit` (core, sortable, utilities), `react-rnd`
  - **Rich Text Editor:** `react-quill-new`
  - **Math Input:** `mathlive`
  - **PDF Export:** `jspdf`, `html2canvas`
  - **Icons:** `lucide-react`

## Project Structure

```text
src/
├── assets/            # Static assets (images, fonts, etc.)
├── pages/             # React Router page components (e.g., Editor)
├── App.tsx            # Main application component and routing setup
├── index.css          # Global styles
├── main.tsx           # Application entry point
├── store.ts           # Zustand global state management
├── supabase.ts        # Supabase client initialization
└── types.ts           # TypeScript interfaces and types
```

## Features

- **Interactive Editor:** Drag, drop, and resize elements to build custom page layouts.
- **Rich Text & Math:** Support for complex text formatting and live mathematical equations.
- **State Persistence:** Seamless real-time state management using Zustand and synchronization with Supabase.
- **Export to PDF:** Generate high-quality PDFs directly from the browser using `jspdf` and `html2canvas`.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm, yarn, or pnpm
- A Supabase project for backend data storage

### Installation

1. Clone the repository and navigate to the project directory.
2. Install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Environment Setup

Create a `.env` file in the root of the project and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

*(You can refer to the `supabase-setup.sql` file in the root directory for setting up your database schema).*

### Running the Development Server

Start the Vite development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

The application will be available at [http://localhost:5173](http://localhost:5173).

## Scripts

- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles TypeScript and builds the application for production.
- `npm run preview`: Bootstraps a local web server to preview the production build.
- `npm run lint`: Runs ESLint for code quality checks.