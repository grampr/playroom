'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const generateRoomId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    // Fallback UUID v4 for non-HTTPS or older browsers
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  };

  const createRoom = () => {
    setIsCreating(true);
    const newRoomId = generateRoomId();
    router.push(`/room/${newRoomId}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    router.push(`/room/${roomId.trim()}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 mb-2">
            ラウンジ
          </h1>
          <p className="text-gray-400 text-lg">
            リアルタイム マルチプレイヤー キャンバス & ゲーム
          </p>
        </div>

        <Card className="glass-card">
          <div className="space-y-6">
            <div className="text-center">
              <Button
                onClick={createRoom}
                className="w-full py-4 text-lg"
                isLoading={isCreating}
              >
                新しいルームを作成
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-600"></span>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">またはIDで参加</span>
              </div>
            </div>

            <form onSubmit={joinRoom} className="space-y-4">
              <Input
                placeholder="ルームIDを入力"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="text-center text-lg tracking-widest"
              />
              <Button
                variant="secondary"
                className="w-full"
                type="submit"
                disabled={!roomId.trim()}
              >
                ルームに参加
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </main>
  );
}
