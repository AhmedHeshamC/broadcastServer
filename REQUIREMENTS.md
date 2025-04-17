Broadcast Server
Build a server that can broadcast messages to connected clients.

You are required to create a simple broadcast server that will allow clients to connect to it, send messages that will be broadcasted to all connected clients.

Goal
The goal of this project is to help you understand how to work with websockets and implement real-time communication between clients and servers. This will help you understand how the real-time features of applications like chat applications, live scoreboards, etc., work.

Requirements
You are required to build a CLI based application that can be used to either start the server or connect to the server as a client. Here are the sample commands that you can use:

broadcast-server start - This command will start the server.
broadcast-server connect - This command will connect the client to the server.
When the server is started using the broadcast-server start command, it should listen for client connections on a specified port (you can configure that using command options or hardcode for simplicity). When a client connects and sends a message, the server should broadcast this message to all connected clients.

The server should be able to handle multiple clients connecting and disconnecting gracefully.

Implementation
You can use any programming language to implement this project. Here are some of the steps that you can follow to implement this project:

Create a server that listens for incoming connections.
When a client connects, store the connection in a list of connected clients.
When a client sends a message, broadcast this message to all connected clients.
Handle client disconnections and remove the client from the list of connected clients.
Implement a client that can connect to the server and send messages.
Test the server by connecting multiple clients and sending messages.
Implement error handling and graceful shutdown of the server.
This project will help you understand how to work with websockets and implement real-time communication between clients and servers. You can extend this project by adding features like authentication, message history, etc.