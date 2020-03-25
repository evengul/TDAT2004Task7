'use strict';

const net = require('net');
const CryptoJS = require('crypto-js');
const Base64 = require('crypto-js/enc-base64');
const fs = require('fs');

// Simple HTTP server responds with a simple WebSocket client test
const httpServer = net.createServer(connection => {
    connection.on('data', () => {
        let content = fs.readFileSync("./index.html");
        connection.write('HTTP/1.1 200 OK\r\nContent-Length: ' + content.length + '\r\n\r\n' + content);
    });
});

httpServer.listen(3000, () => {
    console.log('HTTP server listening on port 3000');
});

let clients = [];

// Incomplete WebSocket server
const wsServer = net.createServer(connection => {
    console.log('Client connected');

    connection.on('data', data => {
        if (!(data.toString().includes("HTTP/1.1"))){
            let bytes = data;
            let length = bytes[1] & 127;
            let maskStart = 2;
            let dataStart = maskStart + 4;

            let parsedData = "";

            for (let i = dataStart; i < dataStart + length; i++){
                let byte = bytes[i] ^ bytes[maskStart + ((i - dataStart)) % 4];
                parsedData += String.fromCharCode(byte);
            }
            connection.write(frameData(parsedData));

            for (let i = 0; i < clients.length; i++){
                if (!clients[i].destroyed){
                    clients[i].write(frameData(parsedData));
                }
            }

            //setInterval(() => connection.write(frameData("Interval function!")), 3000);
        }
        else{

            if (clients.indexOf(connection) === -1){
                console.log("pushing");
                clients.push(connection);
            }

            let clientKey = data.toString()
                .split("\n")
                .filter((line) => line.includes("Sec-WebSocket-Key"))[0].split(": ")[1].slice(0, -1);

            let serverKey = Base64.stringify(CryptoJS.SHA1(clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"));

            let returnValue = "HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                "Sec-WebSocket-Accept: " + serverKey.trim() + "\r\n" +
                "\r\n";

            connection.write(returnValue);
        }

    });

    connection.on('end', () => {
        console.log('Client disconnected');
        clients = clients.filter(e => e !== connection);
        connection.end();
        connection.destroy();
    });
});
wsServer.on('error', error => {
    console.error('Error: ', error);
});

wsServer.listen(3001, () => {
    console.log('WebSocket server listening on port 3001');
});

function frameData(str){
    let type = 0x81;
    let length = str.length;
    if (length > 127){
        throw new Error("Cannot process more than 127 bytes of sending. Make a buffer");
    }
    let maskedAndLength = 0b00000000 | length;
    let data = Buffer.from(str);

    let frame = [type];
    frame.push(maskedAndLength);
    for (let i = 0; i < data.length; i++){
        frame.push(data[i]);
    }
    return Buffer.from(frame);
}
