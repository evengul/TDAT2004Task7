'use strict';

const net = require('net');
const sha1 = require('crypto-js/sha1');
const Base64 = require('crypto-js/enc-base64');

// Simple HTTP server responds with a simple WebSocket client test
const httpServer = net.createServer(connection => {
    connection.on('data', () => {
        let content = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    WebSocket test page
    <script>
      let ws = new WebSocket('ws://localhost:3001');
      ws.onmessage = event => alert('Message from server: ' + event.data);
      ws.onopen = () => ws.send('hello');
    </script>
  </body>
</html>
`;
        connection.write('HTTP/1.1 200 OK\r\nContent-Length: ' + content.length + '\r\n\r\n' + content);
    });
});
httpServer.listen(3000, () => {
    console.log('HTTP server listening on port 3000');
});

// Incomplete WebSocket server
const wsServer = net.createServer(connection => {
    console.log('Client connected');

    connection.on('data', data => {
        let clientKey = data.toString().split("\n").filter((line) => line.includes("Sec-WebSocket-Key"))[0].split(": ")[1];

        let serverKey = Base64.stringify(sha1(clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"));

        let returnValue = "HTTP/1.1 101 Switching Protocols\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            "Sec-WebSocket-Accept: " + serverKey.trim() + "\r\n"+
            "Content-Length: 3\r\n" +
            "hei\r\n";

        connection.write(returnValue);
    });

    connection.on('end', () => {
        console.log('Client disconnected');
        connection.end();
    });
});
wsServer.on('error', error => {
    console.error('Error: ', error);
});
wsServer.listen(3001, () => {
    console.log('WebSocket server listening on port 3001');
});
