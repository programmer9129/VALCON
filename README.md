# VALCON

VALCON is an in-development browser-based operating environment that combines a C++ command engine, cloud file storage, and a desktop-style interface into one web application.

## Overview

VALCON is a web-based desktop with a terminal, text editor, file manager, music player, and settings app. A Node/Express bridge connects the C++ command engine to Supabase, so commands run in the cloud and files are created, read, written, and deleted straight from the browser. Accounts and profiles are handled through the bridge as well.

## Features

- Run commands through a C++ command engine with a calculator and number utilities
- Desktop-style browser UI with a dock, window manager, and per-app windows
- Terminal that talks to the C++ engine through the bridge
- Text editor with tabs, line numbers, word wrap, and open/save/save-as
- File manager for browsing and managing Supabase-backed files
- Music player for local and cloud-hosted audio, with optional upload
- User accounts and profiles with an authentication gate
- Settings app for appearance, dock, windows, terminal, music, and network options
- CORS-enabled bridge suitable for deployment on Render

## POSSIBLE FUTURE ADDON:

1. Inbuilt Godot game engine and a page where all Godot games are stored so they can be played.
2. A drawing area.
3. A clock.

If needed or possible we will add more things; for now they are not planned.

### STATUS

Completed 

### COMMITMENT

- AI has been used to solve heavy and difficult bugs (backend).
- The project is otherwise fully handmade; no AI has been used beyond heavy or difficult bug solving (backend).
- AI is used to resolve git repo conflicts (frontend).
- AI is been used to make the supabase error resolved

## Tech Stack

### Backend

C++ (Crow) is the HTTP server that exposes the command engine, calculator, and a few utility routes.

### Bridge

Node.js and Express form the API layer between the frontend, the C++ backend, and Supabase. It handles filesystem operations, terminal forwarding, and account registration/deletion.

### Frontend

Vite with vanilla JS provides a desktop-style UI built with WebAwesome components and WinBox windows.

### Storage

Supabase handles storage and accounts; every file you create lands in a Supabase storage bucket (default name `valcon-files`).

## Project Structure

```
valcon/
├── backend/        # C++ backend (Crow HTTP server)
├── bridge/         # Node/Express API bridge to Supabase
├── frontend/       # web frontend (Vite + vanilla JS)
│   └── apps/       # terminal, editor, files, music, settings
├── Dockerfile      # container config
└── apt.txt         # system packages
```

## Getting Started

### Prerequisites

You'll want a C++ toolchain (g++ / CMake) to build the backend, Node.js for the bridge and frontend, and a Supabase project with a storage bucket (default name `valcon-files`).

### Installation

```bash
# Backend
cd backend
cmake --preset <preset> && cmake --build build

# Bridge
cd bridge
npm install

# Frontend
cd frontend
npm install
```

### Running Locally

```bash
# Terminal 1 — bridge
cd bridge
node server.js

# Terminal 2 — frontend
cd frontend
npm run dev
```

### Environment Variables

```bash
# Bridge
PORT=3000
CPP_BACKEND_URL=http://localhost:8080

# Supabase credentials for the bridge
SUPABASE_URL=<supabase project url>
SUPABASE_PUBLISHABLE_KEY=<supabase publishable/anon key>
SUPABASE_SECRET_KEY=<supabase secret/service-role key>   # needed for accounts

# Optional
ALLOWED_ORIGINS=https://your-frontend.example.com
VALCON_BRIDGE_KEY=<shared key for /server_bridge/fs>

# Frontend (build-time defaults, overridable at runtime in Settings > Network)
VITE_API_URL=https://your-bridge.example.com
VITE_BRIDGE_URL=http://localhost:3000
VITE_MUSIC_UPLOAD_URL=
VITE_MUSIC_PLAY_URL=
```

## Docker

The Dockerfile builds and runs the C++ backend only:

```bash
docker build -t valcon-backend .
docker run -p 8080:8080 valcon-backend
```

The bridge and frontend are run separately (for example, bridge on Render and the frontend as a static build).

## API

The bridge exposes the following routes:

```text
GET    /                          service info
GET    /server_bridge             health check
GET    /server_bridge/cpp         forward to the C++ backend
POST   /fs                        filesystem operations (Bearer auth)
POST   /server_bridge/fs          filesystem operations (bridge key)
GET    /json                      terminal endpoint health check
POST   /json                      run a command via the C++ backend
POST   /auth/register             register an account
DELETE /account                   delete the current account
```

Filesystem operations (via `POST /fs`) include `cd`, `ls`, `mkdir`, `mkfile`, `read`, `write`, `append`, `delete_file`, `deldir`, `rename`, `move`, `copy`, `stat`, `tree`, `du`, `find`, and `grep`.
