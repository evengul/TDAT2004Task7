'use strict';

const net = require('net');
const CryptoJS = require('crypto-js');
const Base64 = require('crypto-js/enc-base64');
const fs = require('fs');

// Simple HTTP server responds with a simple WebSocket client test
const httpServer = net.createServer(connection => {
    connection.on('data', () => {
        //Changed the text html to reading a file
        let content = fs.readFileSync("./index.html");
        connection.write('HTTP/1.1 200 OK\r\nContent-Length: ' + content.length + '\r\n\r\n' + content);
    });
});

httpServer.listen(3000, () => {
    console.log('HTTP server listening on port 3000');
});

//Container for all connected clients that we will send data to
let clients = [];

// Incomplete WebSocket server
const wsServer = net.createServer(connection => {
    console.log('Client connected');

    connection.on('data', data => {
        //If this is a standard data package
        if (!(data.toString().includes("HTTP"))){
            //Parse the data
            let bytes = data;
            let length = bytes[1] & 127;
            let maskStart = 2;
            let dataStart = maskStart + 4;

            let parsedData = "";

            for (let i = dataStart; i < dataStart + length; i++){
                let byte = bytes[i] ^ bytes[maskStart + ((i - dataStart)) % 4];
                parsedData += String.fromCharCode(byte);
            }

            //For every client
            for (let i = 0; i < clients.length; i++){
                //If the data is not a FIN package
                if (Buffer.from(data)[0] !== 136){
                    //If the client still exists, and is not this same client we are sending from
                    if (!clients[i].destroyed && clients[i] !== connection){
                        //Write the data to all other clients than "yourself"
                        clients[i].write(frameData(parsedData));
                    }
                    //If this is our client
                    else if (clients[i] === connection){
                        //Give a message that we have sent data to other clients
                        clients[i].write(frameData("Data sent to all other clients!"));
                    }
                }
            }
        }
        //If this is the first connection of this client to this websocket
        else{
            //If the connection does not exist in the clients array, push it
            if (clients.indexOf(connection) === -1){
                console.log("pushing");
                clients.push(connection);
            }

            //Retrieve the key from the http request. Remember to remove \r on the end of the line
            let clientKey = data.toString()
                .split("\n")
                .filter((line) => line.includes("Sec-WebSocket-Key"))[0].split(": ")[1].slice(0, -1);

            //Create the server key we send back
            let serverKey = Base64.stringify(CryptoJS.SHA1(clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"));

            //Create the http response
            let returnValue = "HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                "Sec-WebSocket-Accept: " + serverKey.trim() + "\r\n" +
                "\r\n";

            //Write the http response
            connection.write(returnValue);
        }

    });

    connection.on('end', () => {
        console.log('Client disconnected');
        //Remove the client from the list of clients we send data to
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

//For framing data for sending through the websocket
function frameData(str){
    let type = 0x81;                                //We send text messages
    let length = str.length;                        //Of a certain length
    if (length > 127){                              //We can only send 127 bytes at a time.
        throw new Error("Cannot process more than 127 bytes of sending. Make a buffer");
    }
    let maskedAndLength = 0b00000000 | length;      //We do not mask our data from the server. Leftmost bit would be 1 if we did.
    let data = Buffer.from(str);                    //Get the bytes from the string we are sending

    let frame = [type];                             //Add the type to our framed data
    frame.push(maskedAndLength);                    //Add the mask bit and length bits to our framed data
    for (let i = 0; i < data.length; i++){
        frame.push(data[i]);                        //Add the data to our framed data
    }
    return Buffer.from(frame);                      //Return a byte array that we can send to our clients through the socket.
}
