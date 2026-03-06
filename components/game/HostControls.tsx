import React from 'react';
import { Button } from '@/components/ui/Button';

interface HostControlsProps {
    phase: 'LOBBY' | 'ANSWERING' | 'REVEAL';
    onStart: () => void;
    onEnd: () => void;
}

export const HostControls: React.FC<HostControlsProps> = ({
    phase,
    onStart,
    onEnd
}) => {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex gap-2 p-2 bg-gray-900/90 backdrop-blur-md rounded-xl border border-gray-700 shadow-2xl">
            <div className="flex flex-col gap-1 mr-2 px-2 border-r border-gray-700 justify-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">HOST</span>
            </div>
            {phase === 'LOBBY' && (
                <Button variant="primary" size="sm" onClick={onStart}>
                    ゲーム開始
                </Button>
            )}
            {phase === 'ANSWERING' && (
                <Button variant="danger" size="sm" onClick={onEnd}>
                    ゲーム終了
                </Button>
            )}

        </div>
    );
};
