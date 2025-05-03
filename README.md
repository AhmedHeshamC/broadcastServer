# Broadcast Server - By Ahmed Hesham

## Installation

1. **Clone the repository** or download the ZIP file and extract it.
2. **Install dependencies**: Navigate to the project directory in your terminal and run:

   ```bash
   npm install
   ```

3. **Create `tsconfig.json`**: Ensure you have a `tsconfig.json` file in the root directory with `"module": "CommonJS"`. You can generate one with `npx tsc --init` and modify it, or use the example below:

   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "target": "ES2016",
       "module": "CommonJS",
       "outDir": "./dist",
       "rootDir": "./",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "moduleResolution": "node"
     },
     "include": ["**/*.ts"],
     "exclude": ["node_modules"]
   }
   ```

## Usage

### Start the Server (CLI Mode)

Open a terminal and run:

```bash
npx ts-node broadcast-server.ts start --port 8080
```

- You can omit `--port 8080` to use the default port 8080.
- The server will start and print:
  ```
  Broadcast server started on ws://localhost:8080
  ```

### Start the Server with Web UI

To start the server with the web-based chat UI, run:

```bash
npm run web
```

Or manually:

```bash
node build-ui.js && npx ts-node broadcast-server.ts web --port 8080
```

- This will compile the UI TypeScript files, bundle them, and start the server.
- Open your browser and navigate to `http://localhost:8080` to access the chat UI.
- Multiple users can connect by opening the same URL in different browsers or tabs.

### Connect as a Client

Open one or more **new** terminal windows and run:

```bash
npx ts-node broadcast-server.ts connect --host localhost --port 8080
```

- You can omit `--host localhost` and `--port 8080` to use the defaults.
- Each client will connect and print:
  ```
  Connected to ws://localhost:8080
  >
  ```
- The `>` indicates the client is ready for input.

### Sending and Receiving Messages

1.  **In any client terminal**, type a message (e.g., `Hello everyone!`) and press Enter.
2.  That message will be sent to the server.
3.  The server will broadcast the message to **all other connected clients**.
4.  Other clients will display the received message:
    ```

    [Broadcast] Hello everyone!
    >
    ```
    (The prompt `>` reappears, ready for more input).

### Example Workflow

**Terminal 1 (Server):**

```bash
$ npx ts-node broadcast-server.ts start
Broadcast server started on ws://localhost:8080
```

**Terminal 2 (Client 1):**

```bash
$ npx ts-node broadcast-server.ts connect
Connected to ws://localhost:8080
> Hi from Client 1!
>
[Broadcast] Hey Client 1, this is Client 2!
>
```

**Terminal 3 (Client 2):**

```bash
$ npx ts-node broadcast-server.ts connect
Connected to ws://localhost:8080
>
[Broadcast] Hi from Client 1!
> Hey Client 1, this is Client 2!
>
```

## Graceful Shutdown

To stop the server, you can usually just close the terminal window. However, for a graceful shutdown (to allow current connections to finish), you can:

1.  **In the server terminal**, press `Ctrl + C`.
2.  You should see a message like `Broadcast server stopped`.


## Troubleshooting

- **`ERR_UNKNOWN_FILE_EXTENSION`**: This usually means Node.js is trying to run `.ts` files as ES Modules. Ensure your `package.json` does **not** contain `"type": "module"` and your `tsconfig.json` specifies `"module": "CommonJS"`. Make sure all `.ts` files use `require()` and `exports` (CommonJS syntax).
- **`implicitly has an 'any' type`**: Add explicit types in your TypeScript code or configure `"noImplicitAny": false` in your `tsconfig.json` (not recommended for strictness).

## Project URLs
- https://roadmap.sh/projects/broadcast-server
- https://github.com/AhmedHeshamC/broadcastServer


## Testing

The application includes a comprehensive test suite that tests the real code without mocking. To run the tests:

```bash
npm test
```

To run a specific test file:

```bash
npm test -- tests/core-functionality.test.ts
```

### Test Files

- **core-functionality.test.ts**: Tests the core functionality of the application.
- **models.test.ts**: Tests the data models (Message and User).
- **ui-components.test.ts**: Tests the UI components in a jsdom environment.

See the [tests/README.md](tests/README.md) file for more details on the testing approach.

## 🤝 Contributing

1. Fork the repo
2. Create feature branch
3. Write tests (following the no-mocking approach)
4. Submit a PR

Please adhere to the existing code style and coverage requirements.

---

© 2025 Ahmed Hesham. MIT License.
