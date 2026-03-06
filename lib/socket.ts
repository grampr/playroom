import { io, Socket } from 'socket.io-client';

let socket: Socket;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io({
            path: '/api/socket',
            transports: ['websocket'], // force websocket for performance
            reconnectionAttempts: 5,
        });
    }
    return socket;
};
