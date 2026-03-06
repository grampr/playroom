'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Lobby } from '@/components/game/Lobby';
import { PlayField } from '@/components/game/PlayField';
import { HostControls } from '@/components/game/HostControls';

interface User {
    id: string;
    name: string;
}

type Phase = 'LOBBY' | 'ANSWERING' | 'REVEAL';

interface RoundState {
    roundId: number;
    question: string;
    startedAt: number;
    durationSec: number;
    participantIds: string[];
    totalParticipants: number;
}

interface Answer {
    userId: string;
    userName: string;
    mode: 'text' | 'draw';
    text?: string;
    image?: string;
}

interface AnswerProgress {
    answeredCount: number;
    totalParticipants: number;
}

export default function RoomPage() {
    const params = useParams();
    const roomId = params.roomId as string;

    const [userName, setUserName] = useState('');
    const [hasJoined, setHasJoined] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [phase, setPhase] = useState<Phase>('LOBBY');
    const [round, setRound] = useState<RoundState | null>(null);
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [answerProgress, setAnswerProgress] = useState<AnswerProgress>({
        answeredCount: 0,
        totalParticipants: 0
    });
    const [shareStatus, setShareStatus] = useState('');

    const socketRef = useRef<any>(null);
    const shareTimeoutRef = useRef<number | null>(null);

    const joinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (!userName.trim()) return;

        const socket = getSocket();
        socketRef.current = socket;

        socket.connect();
        socket.emit('JOIN_ROOM', { roomId, userName });

        setHasJoined(true);
    };

    useEffect(() => {
        if (!hasJoined) return;
        const socket = socketRef.current;
        if (!socket) return;

        socket.on('ROOM_UPDATE', (data: { users: User[] }) => {
            setUsers(data.users);
        });

        socket.on('ROUND_START', (data: RoundState) => {
            setPhase('ANSWERING');
            setRound(data);
            setAnswers([]);
            setAnswerProgress({
                answeredCount: 0,
                totalParticipants: data.totalParticipants
            });
        });

        socket.on('ANSWER_PROGRESS', (data: AnswerProgress) => {
            setAnswerProgress(data);
        });

        socket.on('ROUND_REVEAL', (data: { roundId: number; answers: Answer[] }) => {
            setPhase('REVEAL');
            setAnswers(data.answers || []);
        });

        socket.on('ROUND_SYNC', (data: RoundState & { phase: Phase; answers?: Answer[]; answeredCount?: number }) => {
            if (!data || data.phase === 'LOBBY') return;
            setPhase(data.phase);
            setRound(data);
            setAnswerProgress({
                answeredCount: data.answeredCount ?? 0,
                totalParticipants: data.totalParticipants
            });
            if (data.phase === 'REVEAL') {
                setAnswers(data.answers || []);
            } else {
                setAnswers([]);
            }
        });

        socket.on('GAME_END', () => {
            setPhase('LOBBY');
            setRound(null);
            setAnswers([]);
            setAnswerProgress({ answeredCount: 0, totalParticipants: 0 });
        });

        return () => {
            socket.off('ROOM_UPDATE');
            socket.off('ROUND_START');
            socket.off('ANSWER_PROGRESS');
            socket.off('ROUND_REVEAL');
            socket.off('ROUND_SYNC');
            socket.off('GAME_END');
        };
    }, [hasJoined, roomId]);

    useEffect(() => {
        return () => {
            if (shareTimeoutRef.current) {
                window.clearTimeout(shareTimeoutRef.current);
            }
        };
    }, []);

    const myId = socketRef.current?.id as string | undefined;
    const isHost = users.length > 0 && users[users.length - 1].id === myId;
    const isParticipant = !!(myId && round?.participantIds?.includes(myId));

    const startGame = () => {
        if (socketRef.current) {
            socketRef.current.emit('HOST_ACTION', { roomId, action: 'START_GAME' });
        }
    };

    const endGame = () => {
        if (socketRef.current) {
            socketRef.current.emit('HOST_ACTION', { roomId, action: 'END_GAME' });
        }
    };

    const judgeMatch = () => {
        if (socketRef.current && round) {
            socketRef.current.emit('HOST_JUDGE', { roomId, roundId: round.roundId, result: 'MATCH' });
        }
    };

    const judgeNoMatch = () => {
        if (socketRef.current && round) {
            socketRef.current.emit('HOST_JUDGE', { roomId, roundId: round.roundId, result: 'NO_MATCH' });
        }
    };

    const submitAnswer = (answer: { mode: 'text' | 'draw'; text?: string; image?: string }) => {
        if (!socketRef.current || !round) return;
        socketRef.current.emit('SUBMIT_ANSWER', {
            roomId,
            roundId: round.roundId,
            ...answer
        });
    };

    const shareRoomLink = async () => {
        const url = `${window.location.origin}/room/${roomId}`;
        try {
            await navigator.clipboard.writeText(url);
            setShareStatus('コピーしました');
        } catch (err) {
            window.prompt('共有リンク', url);
            setShareStatus('リンクを表示しました');
        }
        if (shareTimeoutRef.current) {
            window.clearTimeout(shareTimeoutRef.current);
        }
        shareTimeoutRef.current = window.setTimeout(() => setShareStatus(''), 2000);
    };

    if (!hasJoined) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <Card className="w-full max-w-md glass-card" title="名前を入力してください">
                    <form onSubmit={joinRoom} className="space-y-4">
                        <Input
                            autoFocus
                            placeholder="ニックネーム"
                            value={userName}
                            onChange={e => setUserName(e.target.value)}
                        />
                        <Button type="submit" className="w-full" disabled={!userName.trim()}>
                            ルームに入室
                        </Button>
                    </form>
                </Card>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen flex flex-col p-2 md:p-4 gap-4">
            <div className="flex justify-between items-center bg-gray-900/50 backdrop-blur-sm p-3 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-lg">Room: {roomId.slice(0, 8)}...</span>
                    <span className="text-xs px-2 py-1 bg-blue-900 text-blue-200 rounded-full">
                        {users.length} 人
                    </span>
                    {isHost && (
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" onClick={shareRoomLink}>
                                共有リンク
                            </Button>
                            {shareStatus && <span className="text-xs text-gray-300">{shareStatus}</span>}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${phase === 'ANSWERING' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                    <span className="text-sm font-mono uppercase text-gray-400">{phase}</span>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden rounded-2xl border border-gray-700 bg-gray-800/50 shadow-2xl">
                {phase === 'LOBBY' ? (
                    <div className="p-8 h-full overflow-y-auto">
                        <Lobby
                            users={users}
                            currentUser={{ id: myId || '', name: userName }}
                            roomId={roomId}
                            isHost={isHost}
                            onStart={startGame}
                        />
                    </div>
                ) : (
                    <PlayField
                        question={round?.question || ''}
                        roundId={round?.roundId || 0}
                        phase={phase === 'REVEAL' ? 'REVEAL' : 'ANSWERING'}
                        startedAt={round?.startedAt || Date.now()}
                        durationSec={round?.durationSec || 30}
                        answeredCount={answerProgress.answeredCount}
                        totalParticipants={answerProgress.totalParticipants}
                        isParticipant={isParticipant}
                        answers={answers}
                        onSubmitAnswer={submitAnswer}
                        isHost={isHost}
                        onJudgeMatch={judgeMatch}
                        onJudgeNoMatch={judgeNoMatch}
                    />
                )}
            </div>

            {isHost && (
                <HostControls
                    phase={phase}
                    onStart={startGame}
                    onEnd={endGame}
                />
            )}
        </div>
    );
}
