# Hamare Ram Live Dubbing

A theatre dubbing and audio relay system designed to synchronize dubbed audio playback for live audiences across multiple devices. This system enables seamless control of audio cues during theatrical performances, ensuring all audience members experience the show in perfect sync.

## Project Overview

**Hamare Ram Live Dubbing** is a real-time audio synchronization platform for theatre productions. It consists of a central operator interface for controlling playback and audience client applications that receive and play synchronized audio streams.

### Key Components
- **Operator Interface**: A control panel allowing scene/cue selection, play/pause, fast-forward/rewind, and playback speed adjustments.
- **Audience Client**: A lightweight interface that connects via WebSockets, preloads audio, and plays content in perfect sync across devices.
- **Backend Server**: Manages state, serves static assets, handles WebSocket connections for real-time broadcasting of operator actions.

The system uses WebSockets to broadcast state changes (play, pause, seek, rate changes) from the operator to all connected audience clients, maintaining synchronization within milliseconds using server-side time anchors and offset calculations.

## Features

### Operator Controls
- **Scene and Cue Management**: Select specific scenes and navigate through audio cues.
- **Playback Controls**: Play, pause, fast-forward, rewind, and seek functionality.
- **Speed Control**: Adjust playback rate (e.g., 0.5x to 2x speed) for live performance adjustments.
- **Real-time Broadcasting**: Instantly relay control actions to all connected audience devices.

### Audience Experience
- **Synchronized Playback**: Audio plays in perfect sync across all devices using server-time anchored timing.
- **Language Selection**: Toggle between Hindi and English audio tracks (when available).
- **Autoplay Handling**: "Tap to Start" button to comply with browser autoplay policies.
- **Preloading**: Efficiently preloads next audio cues for seamless transitions.
- **Clock Synchronization**: Maintains accurate timing with server clock offset calculations.

### Technical Features
- **WebSocket State Broadcasting**: Real-time events for `STATE`, `CUE`, `PAUSE`, `RESUME`, `RATE`, `SEEK`.
- **Manifest-Based Cue System**: Dynamic loading of scene manifests with audio file mappings.
- **Fallback Audio Paths**: Supports multiple audio file formats and fallback logic.
- **Service Worker Integration**: Enables offline capabilities and caching for better performance.

## Tech Stack

### Backend
- **Node.js** with **Express**: RESTful API and static file serving.
- **WebSockets (ws library)**: Real-time bidirectional communication.
- **TypeScript**: Type-safe server-side development.
- **Port**: 5174

### Frontend
- **React**: Component-based UI development.
- **Vite**: Fast build tool and development server.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **TypeScript**: Type-safe frontend development.

### Data & Assets
- **JSON Manifests**: Scene and cue definitions in `src/data/playData.json`.
- **Audio Files**: Stored in `/public/Audio` directory with organized scene-based naming (e.g., `1_3_vashishth.wav`).

### Deployment
- **Docker**: Containerized deployment with multi-stage builds.
- **Docker Compose**: Orchestration for easy deployment.

## Installation

### Prerequisites
- Node.js v18 or higher
- npm (comes with Node.js)
- Docker and Docker Compose (for containerized deployment)

### Local Setup
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd live_dubbing
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build:all
   ```

## Development

### Running in Development Mode
1. Start the frontend development server:
   ```bash
   npm run dev
   ```
   This starts Vite dev server on port 5173.

2. Build and start the backend server:
   ```bash
   npm run build:server
   npm run start:server
   ```
   The backend runs on port 5174.

### Available Scripts
- `npm run dev`: Start Vite development server for frontend
- `npm run build`: Build frontend for production
- `npm run build:server`: Compile TypeScript server code
- `npm run start:server`: Run the compiled server
- `npm run build:all`: Build both frontend and backend
- `npm run lint`: Run ESLint for code quality checks

## Deployment

### Using Docker
1. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

2. The application will be available at `http://localhost:5174`

### Manual Deployment
1. Build the application:
   ```bash
   npm run build:all
   ```

2. Start the server:
   ```bash
   npm run start:server
   ```

## Usage

### Operator Workflow
1. Access the operator interface at the root URL (`/`).
2. Select a scene from the available options.
3. Use playback controls to manage the performance:
   - Click play/pause to control playback state
   - Adjust playback rate using speed controls
   - Seek forward/backward as needed
4. The system automatically broadcasts state changes to all connected audience clients.

### Audience Experience
1. Audience members access `/frontx` on their devices.
2. Select preferred language (Hindi/English) if multiple tracks are available.
3. Tap "Tap to Start" to unlock audio playback.
4. Audio will automatically sync and play in real-time as the operator controls the performance.

### API Endpoints
- `GET /manifest/:sceneId`: Retrieve cue manifest for a specific scene
- `GET /current`: Get current playback state
- `POST /update`: Update playback state (operator use)

### WebSocket Events
- Connect to `ws://<host>:5174/ws` for real-time updates
- Events: `STATE`, `CUE`, `PAUSE`, `RESUME`, `RATE`, `SEEK`

## Project Structure

```
/
├── server/
│   └── server.ts              # Express server with WebSocket support
├── src/
│   ├── components/
│   │   └── DubbingInterface.tsx  # Operator control panel
│   ├── data/
│   │   └── playData.json       # Scene and cue definitions
│   ├── lib/
│   │   └── ws.ts               # WebSocket client utilities
│   ├── FrontX.tsx              # Audience client component
│   └── ...
├── public/
│   └── Audio/                  # Audio files organized by scene
├── dist/                       # Built frontend assets
├── dist-server/                # Compiled server code
├── Dockerfile                  # Docker build configuration
├── docker-compose.yml          # Docker Compose setup
└── package.json                # Project dependencies and scripts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure tests pass and code is linted
5. Submit a pull request

## License

This project is licensed under the MIT License.