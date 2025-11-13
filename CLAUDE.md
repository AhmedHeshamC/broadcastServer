# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a WebSocket-based broadcast server implemented in TypeScript using CommonJS module system. The project follows a CLI-based architecture with separate server and client components.

**Key Components:**
- `broadcast-server.ts` - CLI entry point using Commander.js
- `server.ts` - WebSocket server with multi-client connection management
- `client.ts` - Interactive WebSocket client with readline interface
- `types.ts` - TypeScript interface definitions (currently minimal)

**Message Protocol:**
The system uses JSON-formatted messages with different types:
- `your_name`: Server assigns name to new client (`User` + random number)
- `message`: User messages with sender identification
- `system`: Connection/disconnection notifications

## Development Commands

### Running the Application

**Start Server:**
```bash
npx ts-node broadcast-server.ts start --port 8080
```
- Default port: 8080
- Server listens on ws://localhost:PORT

**Connect Client:**
```bash
npx ts-node broadcast-server.ts connect --host localhost --port 8080
```
- Default host: localhost
- Default port: 8080
- Uses interactive readline interface with `>` prompt

### TypeScript Compilation

**Compile TypeScript:**
```bash
npx tsc
```
- Output directory: `./dist`
- Target: ES2016
- Module system: CommonJS

**Configuration Notes:**
- `package.json` must NOT contain `"type": "module"`
- `tsconfig.json` must specify `"module": "CommonJS"`
- All files use CommonJS syntax (`require()`, `exports.functionName`)

## Implementation Patterns

**Server Architecture:**
- Uses `Map<WebSocket, string>` to track client connections
- Handles SIGINT for graceful shutdown
- Broadcasts messages to all clients except sender
- Automatic client name assignment

**Client Architecture:**
- Interactive CLI using `readline` interface
- Real-time message sending and receiving
- Clean terminal output with prompt management
- Connection error handling

**Error Handling:**
- Connection cleanup on client disconnect
- Graceful server shutdown with process signal handling
- Client reconnection error handling

## Dependencies

- `ws` - WebSocket library (8.18.1)
- `commander` - CLI framework (13.1.0)
- `typescript` - TypeScript compiler (5.8.3)
- `@types/ws`, `@types/node` - TypeScript definitions

## Testing

Currently no test framework is configured. The package.json contains a placeholder test script.