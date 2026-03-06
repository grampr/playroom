const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const redis = require('./lib/redis-client');
const questions = require('./lib/questions');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const io = new Server(server, {
        path: '/api/socket', // Custom path to avoid conflict with Next.js
        addTrailingSlash: false,
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    const roomStates = new Map();
    const socketUsers = new Map();

    const getRoomSocketIds = (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        return room ? Array.from(room) : [];
    };

    const getOrCreateRoomState = (roomId) => {
        if (!roomStates.has(roomId)) {
            roomStates.set(roomId, {
                phase: 'LOBBY',
                roundId: 0,
                question: '',
                startedAt: 0,
                durationSec: 30,
                answers: new Map(),
                participants: new Set(),
                answeredIds: new Set(),
                timer: null
            });
        }
        return roomStates.get(roomId);
    };

    const pickRandomQuestion = () => {
        if (!questions.length) return 'お題が未設定です';
        const index = Math.floor(Math.random() * questions.length);
        return questions[index];
    };

    const endGame = (roomId, payload = {}) => {
        const state = roomStates.get(roomId);
        if (state?.timer) clearTimeout(state.timer);
        if (state) state.phase = 'LOBBY';
        io.to(roomId).emit('GAME_END', payload);
    };

    const revealRound = (roomId) => {
        const state = roomStates.get(roomId);
        if (!state || state.phase !== 'ANSWERING') return;
        state.phase = 'REVEAL';
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        const answers = Array.from(state.answers.values());
        io.to(roomId).emit('ROUND_REVEAL', {
            roundId: state.roundId,
            answers
        });
    };

    const startRound = (roomId) => {
        const state = getOrCreateRoomState(roomId);
        state.roundId += 1;
        state.phase = 'ANSWERING';
        state.question = pickRandomQuestion();
        state.startedAt = Date.now();
        state.durationSec = 30;
        state.answers = new Map();
        state.answeredIds = new Set();
        state.participants = new Set(getRoomSocketIds(roomId));
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => revealRound(roomId), state.durationSec * 1000);

        const participantIds = Array.from(state.participants);
        io.to(roomId).emit('ROUND_START', {
            roundId: state.roundId,
            question: state.question,
            startedAt: state.startedAt,
            durationSec: state.durationSec,
            participantIds,
            totalParticipants: participantIds.length
        });
        io.to(roomId).emit('ANSWER_PROGRESS', {
            answeredCount: 0,
            totalParticipants: participantIds.length
        });
    };

    const sendRoundSync = (socket, roomId) => {
        const state = roomStates.get(roomId);
        if (!state || state.phase === 'LOBBY') return;
        const payload = {
            roundId: state.roundId,
            phase: state.phase,
            question: state.question,
            startedAt: state.startedAt,
            durationSec: state.durationSec,
            participantIds: Array.from(state.participants),
            totalParticipants: state.participants.size,
            answeredCount: state.answeredIds.size
        };
        if (state.phase === 'REVEAL') {
            payload.answers = Array.from(state.answers.values());
        }
        socket.emit('ROUND_SYNC', payload);
    };

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // 1. Join Room
        socket.on('JOIN_ROOM', async ({ roomId, userName }) => {
            socket.join(roomId);
            console.log(`${userName} (${socket.id}) joined room ${roomId}`);

            // Add to Redis list
            // We store simple JSON strings for user info
            const user = { id: socket.id, name: userName };
            const userStr = JSON.stringify(user);
            socketUsers.set(socket.id, { roomId, userName, userStr });
            await redis.lpush(`room:${roomId}:users`, userStr);

            // Broadcast update to room
            // Get updated list (limit to 50 for safety, though lrange 0 -1 gets all)
            // For "Summary", we might just need count or a partial list
            const usersStr = await redis.lrange(`room:${roomId}:users`, 0, -1);
            const users = usersStr.map(u => JSON.parse(u));

            io.to(roomId).emit('ROOM_UPDATE', {
                userCount: users.length,
                users: users // In a real app with 50 users, maybe don't send full list every time if not needed
            });

            sendRoundSync(socket, roomId);
        });

        // 2. Drawing Data (Volatile for performance)
        socket.on('DRAW_STROKE', (data) => {
            // data: { roomId, strokeData: [...] }
            if (!data.roomId) return;

            // Relay to others in the room
            // Use volatile to allow dropping packets if network is congested
            socket.to(data.roomId).volatile.emit('UPDATE_CANVAS', data.strokeData);
        });

        // 3. Answer Submission
        socket.on('SUBMIT_ANSWER', (data) => {
            const { roomId, roundId, mode, text, image } = data || {};
            if (!roomId || !roundId) return;
            const state = roomStates.get(roomId);
            if (!state || state.phase !== 'ANSWERING' || state.roundId !== roundId) return;
            if (!state.participants.has(socket.id)) return;
            if (state.answeredIds.has(socket.id)) return;

            const userInfo = socketUsers.get(socket.id);
            const trimmedText = typeof text === 'string' ? text.trim() : '';
            const answerPayload = {
                userId: socket.id,
                userName: userInfo?.userName || 'Unknown',
                mode: mode === 'text' ? 'text' : 'draw',
                text: trimmedText || undefined,
                image: typeof image === 'string' ? image : undefined
            };

            if (answerPayload.mode === 'text' && !answerPayload.text) return;
            if (answerPayload.mode === 'draw' && !answerPayload.image) return;

            state.answers.set(socket.id, answerPayload);
            state.answeredIds.add(socket.id);

            io.to(roomId).emit('ANSWER_PROGRESS', {
                answeredCount: state.answeredIds.size,
                totalParticipants: state.participants.size
            });

            if (state.participants.size > 0 && state.answeredIds.size >= state.participants.size) {
                revealRound(roomId);
            }
        });

        // 3. Host Actions (Start/End Game)
        socket.on('HOST_ACTION', (data) => {
            // data: { roomId, action: 'START_GAME' | 'END_GAME' }
            if (!data.roomId) return;

            console.log(`Host action in ${data.roomId}: ${data.action}`);
            if (data.action === 'START_GAME') {
                startRound(data.roomId);
            } else if (data.action === 'END_GAME') {
                endGame(data.roomId, { reason: 'HOST_END' });
            }
        });

        // 4. Host Judge (Match / No Match)
        socket.on('HOST_JUDGE', (data) => {
            const { roomId, roundId, result } = data || {};
            if (!roomId || !roundId) return;
            const state = roomStates.get(roomId);
            if (!state || state.phase !== 'REVEAL' || state.roundId !== roundId) return;

            if (result === 'MATCH') {
                endGame(roomId, { reason: 'MATCH' });
            } else if (result === 'NO_MATCH') {
                startRound(roomId);
            }
        });

        // 3. Heartbeat / Disconnect
        socket.on('disconnect', async () => {
            console.log('Client disconnected:', socket.id);
            const userInfo = socketUsers.get(socket.id);
            if (!userInfo) return;

            socketUsers.delete(socket.id);
            await redis.lrem(`room:${userInfo.roomId}:users`, 0, userInfo.userStr);

            const usersStr = await redis.lrange(`room:${userInfo.roomId}:users`, 0, -1);
            const users = usersStr.map(u => JSON.parse(u));

            io.to(userInfo.roomId).emit('ROOM_UPDATE', {
                userCount: users.length,
                users
            });

            const state = roomStates.get(userInfo.roomId);
            if (state?.participants?.has(socket.id)) {
                state.participants.delete(socket.id);
                state.answeredIds.delete(socket.id);
                if (state.phase === 'ANSWERING') {
                    io.to(userInfo.roomId).emit('ANSWER_PROGRESS', {
                        answeredCount: state.answeredIds.size,
                        totalParticipants: state.participants.size
                    });
                    if (state.participants.size > 0 && state.answeredIds.size >= state.participants.size) {
                        revealRound(userInfo.roomId);
                    }
                }
            }
        });
    });

    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
