# VALCON

VALCON is an in-development browser-based operating environment that combines a C++ command engine, cloud file storage, and a desktop-style interface into one web application.

## Overview

VALCON is a web-based terminal and file manager that runs a C++ command engine in the cloud and lets you work with text files in a desktop-like browser UI. A Node/Express bridge connects the C++ backend to Supabase storage, so files are created, read, written, and deleted straight from the browser terminal.

## Features

- Run commands through a C++ command engine with a calculator and number utilities
- Create, read, write, and delete text files in Supabase storage
- Desktop-style browser UI with a dock, terminal, and settings app
- CORS-enabled backend suitable for deployment on Render or Heroku
- Runnable as a single Docker container

## POSSIBLE FUTURE ADDON:

1.Inbuilt godot game engine and a page where all godot games are stored where we can play games.
2.Auth ,USER,PROFILE features
3.built-in notepad,and a drawing area
4.a clock

if needed or possible we will add more things , now they are not planned

### STATUS

under devolopment

### COMMITMENT

-- AI hasbeen used to solve heavy bugs and difficult bugs(backend).
--the project is fully handmade ,no AI hasbeen used other than heavy or difficult bug solving(backend).
-- AI is used to solve git repo conflicts(frontend)

## Tech Stack

### Backend

C++ (Crow) is the HTTP server that exposes the command engine, calculator, and a few utility routes.

### Bridge

Node.js and Express form the API layer between the frontend, the C++ backend, and Supabase.

### Frontend

Vite with vanilla JS provides a desktop-style UI built with WebAwesome components and WinBox windows.

### Storage

Supabase handles storage; every file you create lands in a Supabase storage bucket.

## Project Structure

```
valcon/
├── backend/        # C++ backend (Crow HTTP server)
├── bridge/         # Node/Express API bridge to Supabase
├── frontend/       # web frontend (Vite + vanilla JS)
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
npm start

# Terminal 2 — frontend
cd frontend
npm run dev
```

### Environment Variables

```bash
# Supabase credentials for the bridge
SUPABASE_URL=<supabase project url>
SUPABASE_SECRET_KEY=<supabase secret key>

# Bridge port (defaults to 3000)
PORT=3000
```

## Docker

```bash
docker build -t valcon .
docker run -p <port>:<port> valcon
```

Make sure env is setup for all that.

## API

The bridge exposes the following routes:

```text
GET    /server_bridge                         health check
GET    /server_bridge/cpp                     forward to the C++ backend
GET    /server_bridge/supabase                list storage buckets
POST   /server_bridge/files/create            create a file
POST   /server_bridge/files/write             write file contents
GET    /server_bridge/files/read/:filename    read a file
DELETE /server_bridge/files/delete/:filename  delete a file
GET    /server_bridge/files/list              list files in the bucket
```
