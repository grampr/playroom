import React from 'react';
import { Card } from '@/components/ui/Card';

interface User {
    id: string;
    name: string;
}

interface LobbyProps {
    users: User[];
    currentUser: User | null;
    roomId: string;
    isHost: boolean;
    onStart: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
    users,
    currentUser,
    roomId,
    isHost,
    onStart
}) => {
    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            <Card title="ロビー" description={`ルームID: ${roomId}`}>
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm font-medium text-gray-400">
                        <span>参加者 ({users.length}/50)</span>
                        <span className="text-green-400 animate-pulse">ホストを待っています...</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2 bg-gray-900/50 rounded-lg border border-gray-700">
                        {users.map((user) => (
                            <div
                                key={user.id}
                                className={`flex items-center p-3 rounded-md border ${user.id === currentUser?.id
                                    ? 'bg-blue-900/30 border-blue-500/50 text-blue-100'
                                    : 'bg-gray-800 border-gray-700 text-gray-300'
                                    }`}
                            >
                                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                <span className="truncate">{user.name} {user.id === currentUser?.id && '(あなた)'}</span>
                            </div>
                        ))}
                    </div>

                    {isHost ? (
                        <div className="pt-4 border-t border-gray-700">
                            <p className="text-center text-sm text-gray-400 mb-2">あなたがホストです</p>
                            {/* Start Button handled by HostControls mainly, but can be here too */}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-gray-400">ホストがゲームを開始するのを待っています...</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
