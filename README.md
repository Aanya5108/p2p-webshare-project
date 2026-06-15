## P2P Web Share

A browser-to-browser file sharing application built using WebRTC, Socket.IO, React, and Node.js.

## Features

* Secure peer-to-peer file transfer
* Room-based connection system
* Drag and drop file upload
* Auto-download on receiver side
* Transfer progress tracking
* Transfer speed monitoring
* SHA-256 chunk verification
* Graceful disconnect handling
* No server-side file storage

## Tech Stack

Frontend:

* React
* Vite
* Socket.IO Client
* Simple Peer

Backend:

* Node.js
* Express
* Socket.IO

## How It Works

1. User creates a room.
2. Another user joins using the room code.
3. WebRTC connection is established.
4. Files are transferred directly between browsers.
5. Progress, speed, and integrity checks are displayed during transfer.
