import React from 'react';
import { Home, Dices, Gamepad2, Wallet, User } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'home' | 'games' | 'wallet' | 'profile';
  onTabChange: (tab: 'home' | 'games' | 'wallet' | 'profile') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#070e1b]/95 backdrop-blur-lg border-t border-[#15233e] py-2 px-6">
      <div className="max-w-md mx-auto flex items-center justify-between relative">
        {/* Home */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentTab === 'home' ? 'text-[#ffa800]' : 'text-[#5d7399] hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold">Home</span>
          {currentTab === 'home' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffa800] -mt-0.5"></span>
          )}
        </button>

        {/* Games */}
        <button
          onClick={() => onTabChange('games')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentTab === 'games' ? 'text-[#ffa800]' : 'text-[#5d7399] hover:text-white'
          }`}
        >
          <Dices className="w-5 h-5" />
          <span className="text-[10px] font-bold">Games</span>
          {currentTab === 'games' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffa800] -mt-0.5"></span>
          )}
        </button>

        {/* Central Floating Gamepad Button (from sample) */}
        <div className="-mt-7">
          <button
            onClick={() => onTabChange('home')}
            className="w-14 h-14 rounded-full bg-gradient-to-b from-[#ffb800] to-[#e68a00] flex items-center justify-center text-black shadow-[0_0_20px_rgba(255,168,0,0.6)] border-4 border-[#070e1b] active:scale-90 transition-transform cursor-pointer"
          >
            <Gamepad2 className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

        {/* Wallet */}
        <button
          onClick={() => onTabChange('wallet')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentTab === 'wallet' ? 'text-[#ffa800]' : 'text-[#5d7399] hover:text-white'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-bold">Wallet</span>
          {currentTab === 'wallet' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffa800] -mt-0.5"></span>
          )}
        </button>

        {/* Profile */}
        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentTab === 'profile' ? 'text-[#ffa800]' : 'text-[#5d7399] hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold">Profile</span>
          {currentTab === 'profile' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffa800] -mt-0.5"></span>
          )}
        </button>
      </div>
    </div>
  );
};
