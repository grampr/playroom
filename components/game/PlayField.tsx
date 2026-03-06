import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface AnswerPayload {
    mode: 'text' | 'draw';
    text?: string;
    image?: string;
}

interface Answer {
    userId: string;
    userName: string;
    mode: 'text' | 'draw';
    text?: string;
    image?: string;
}

interface PlayFieldProps {
    question: string;
    roundId: number;
    phase: 'ANSWERING' | 'REVEAL';
    startedAt: number;
    durationSec: number;
    answeredCount: number;
    totalParticipants: number;
    isParticipant: boolean;
    answers: Answer[];
    onSubmitAnswer: (answer: AnswerPayload) => void;
    isHost?: boolean;
    onJudgeMatch?: () => void;
    onJudgeNoMatch?: () => void;
}

interface Point {
    x: number;
    y: number;
}

export const PlayField: React.FC<PlayFieldProps> = ({
    question,
    roundId,
    phase,
    startedAt,
    durationSec,
    answeredCount,
    totalParticipants,
    isParticipant,
    answers,
    onSubmitAnswer,
    isHost,
    onJudgeMatch,
    onJudgeNoMatch
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#ffffff');
    const [mode, setMode] = useState<'draw' | 'text'>('draw');
    const [textAnswer, setTextAnswer] = useState('');
    const [hasDrawn, setHasDrawn] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(durationSec);
    const [showAnswerPanel, setShowAnswerPanel] = useState(false);

    const lastPoint = useRef<Point | null>(null);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && containerRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!showAnswerPanel || mode !== 'draw') return;
        const id = requestAnimationFrame(() => {
            if (canvasRef.current && containerRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
            }
        });
        return () => cancelAnimationFrame(id);
    }, [showAnswerPanel, mode]);

    useEffect(() => {
        setMode('draw');
        setTextAnswer('');
        setHasDrawn(false);
        setHasSubmitted(false);
        setShowAnswerPanel(false);
        clearCanvas();
    }, [roundId]);

    useEffect(() => {
        const tick = () => {
            if (phase !== 'ANSWERING') {
                setTimeLeft(0);
                return;
            }
            const endAt = startedAt + durationSec * 1000;
            const leftMs = Math.max(0, endAt - Date.now());
            setTimeLeft(Math.ceil(leftMs / 1000));
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [startedAt, durationSec, phase]);

    useEffect(() => {
        if (phase !== 'ANSWERING') return;
        if (timeLeft > 0) return;
        if (!isParticipant || hasSubmitted) return;
        if (mode === 'draw' && hasDrawn) {
            submitDrawing();
        }
    }, [timeLeft, phase, isParticipant, hasSubmitted, mode, hasDrawn]);

    const canAnswer = phase === 'ANSWERING' && isParticipant && !hasSubmitted;
    const canSubmitText = canAnswer && mode === 'text' && textAnswer.trim().length > 0;
    const canSubmitDraw = canAnswer && mode === 'draw' && hasDrawn;

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!canAnswer || mode !== 'draw') return;
        setIsDrawing(true);
        const pos = getPos(e);
        lastPoint.current = pos;
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !lastPoint.current || !canvasRef.current) return;

        const currentPos = getPos(e);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.stroke();
            setHasDrawn(true);
        }

        lastPoint.current = currentPos;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        lastPoint.current = null;
    };

    const submitText = () => {
        if (!canSubmitText) return;
        onSubmitAnswer({ mode: 'text', text: textAnswer.trim() });
        setHasSubmitted(true);
    };

    const submitDrawing = () => {
        if (!canSubmitDraw || !canvasRef.current) return;
        const image = canvasRef.current.toDataURL('image/png');
        onSubmitAnswer({ mode: 'draw', image });
        setHasSubmitted(true);
    };

    const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        // @ts-ignore - straightforward checking
        const clientX = e.touches ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        // @ts-ignore
        const clientY = e.touches ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    return (
        <div className="w-full h-full flex flex-col gap-4 p-4">
            <div className="flex flex-col items-center gap-3">
                <div className="w-full md:w-4/5 bg-gray-900/70 border border-gray-700 rounded-2xl p-4 md:p-6 text-center shadow-xl">
                    <div className="text-2xl md:text-4xl font-bold text-white tracking-wide">
                        {question || '...'}
                    </div>
                </div>
                <div className="text-sm text-gray-300">
                    残り <span className="font-mono text-white">{timeLeft}s</span>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span>{answeredCount}/{totalParticipants} 回答済み</span>
                {!isParticipant && phase === 'ANSWERING' && (
                    <span className="text-amber-300">途中参加: 次の問題から参加</span>
                )}
                {hasSubmitted && phase === 'ANSWERING' && (
                    <span className="text-green-400">回答済み</span>
                )}
            </div>

            {/* Visual Headers / Host Controls - Only show in REVEAL phase for HOST */}
            {phase === 'REVEAL' && isHost && (
                <div className="flex w-full gap-4 px-2">
                    <button
                        onClick={onJudgeMatch}
                        className="flex-1 bg-black hover:bg-gray-900 text-white py-3 text-center text-xl font-bold border border-yellow-500/30 rounded-lg shadow-lg active:scale-95 transition-transform cursor-pointer"
                    >
                        全員一致
                    </button>
                    <button
                        onClick={onJudgeNoMatch}
                        className="flex-1 bg-black hover:bg-gray-900 text-white py-3 text-center text-xl font-bold border border-yellow-500/30 rounded-lg shadow-lg active:scale-95 transition-transform cursor-pointer"
                    >
                        不一致
                    </button>
                </div>
            )}

            {phase === 'ANSWERING' && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {!showAnswerPanel && (
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => setShowAnswerPanel(true)}
                            disabled={!canAnswer}
                            className="px-8"
                        >
                            回答する
                        </Button>
                    )}
                    {showAnswerPanel && (
                        <>
                            <Button
                                variant={mode === 'draw' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setMode('draw')}
                            >
                                手書き
                            </Button>
                            <Button
                                variant={mode === 'text' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setMode('text')}
                            >
                                テキスト
                            </Button>
                        </>
                    )}
                </div>
            )}

            {phase === 'ANSWERING' && showAnswerPanel && (
                <div className="flex justify-end">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={mode === 'draw' ? submitDrawing : submitText}
                        disabled={mode === 'draw' ? !canSubmitDraw : !canSubmitText}
                    >
                        提出
                    </Button>
                </div>
            )}

            {phase === 'ANSWERING' && showAnswerPanel && mode === 'draw' && (
                <>
                    <div
                        ref={containerRef}
                        className="relative w-full aspect-video bg-gray-900 rounded-xl border border-gray-700 shadow-2xl overflow-hidden cursor-crosshair touch-none"
                    >
                        <canvas
                            ref={canvasRef}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-full"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-800 rounded-lg">
                        {['#ffffff', '#ef4444', '#3b82f6', '#22c55e', '#eab308'].map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                clearCanvas();
                                setHasDrawn(false);
                            }}
                            disabled={!canAnswer}
                        >
                            クリア
                        </Button>
                    </div>
                </>
            )}

            {phase === 'ANSWERING' && showAnswerPanel && mode === 'text' && (
                <div className="flex flex-col gap-3">
                    <Input
                        placeholder="回答を入力..."
                        value={textAnswer}
                        onChange={e => setTextAnswer(e.target.value)}
                        disabled={!canAnswer}
                    />
                </div>
            )}

            {phase === 'REVEAL' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                    {answers.map(answer => (
                        <div key={answer.userId}
                            className="relative aspect-video flex flex-col border-2 border-white overflow-hidden shadow-xl"
                            style={{ backgroundColor: '#0022FF' }}
                        >
                            {/* User Name Top Left Overlay */}
                            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/40 rounded text-white text-xs font-bold">
                                {answer.userName}
                            </div>

                            <div className="flex-1 flex items-center justify-center p-2 pt-8">
                                {answer.mode === 'text' ? (
                                    <div
                                        className="text-4xl md:text-5xl text-white font-bold tracking-wider"
                                        style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif' }}
                                    >
                                        {answer.text || '-'}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <img
                                            src={answer.image || ''}
                                            alt={`${answer.userName} answer`}
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {answers.length === 0 && (
                        <div className="col-span-full text-center text-white text-lg py-8">回答がありません。</div>
                    )}
                </div>
            )}
        </div>
    );
};
