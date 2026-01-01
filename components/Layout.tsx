
import React from 'react';
import { View, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  onViewChange: (view: View) => void;
  currentUser: User | null;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, currentUser }) => {
  // กรองเหลือเพียงเมนูหลักที่แถบด้านล่าง
  const navItems = [
    { id: View.INVENTORY, label: 'สต๊อกคงเหลือ', icon: '📊' },
    { id: View.STOCK_IN, label: 'รับเข้า', icon: '📥' },
    { id: View.STOCK_OUT, label: 'จ่ายออก', icon: '📤' },
  ];

  const headerActionItems = [
    { id: View.REGISTRATION, label: 'ลงทะเบียน', icon: '📝' },
    { id: View.RECEIPT_HISTORY, label: 'ประวัติรับ', icon: '📜' },
    { id: View.RELEASE_HISTORY, label: 'ประวัติจ่าย', icon: '📋' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-purple-600 text-white p-4 shadow-md sticky top-0 z-[60]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div onClick={() => onViewChange(View.INVENTORY)} className="cursor-pointer text-center md:text-left">
            <h1 className="text-xl font-black tracking-tight leading-none">PNK_PD Online Stock</h1>
            <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider mt-1">
              Smart Inventory System {currentUser ? `| USER: ${currentUser.firstName}` : ''}
            </div>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2">
            {headerActionItems.map((item) => (
              <button 
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-[10px] md:text-xs transition-all border ${
                  activeView === item.id 
                  ? 'bg-white text-purple-600 shadow-lg border-white' 
                  : 'bg-purple-500 text-white hover:bg-purple-400 border-purple-400'
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
            
            <div className="w-px h-6 bg-purple-400 mx-1"></div>

            <button 
              onClick={() => onViewChange(View.SETTINGS)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${
                activeView === View.SETTINGS 
                ? 'bg-white text-purple-600 shadow-lg border-white' 
                : 'bg-purple-500 text-white hover:bg-purple-400 border-purple-400'
              }`}
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 mb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-2px_15px_rgba(0,0,0,0.08)] z-50">
        <div className="max-w-md mx-auto flex justify-around p-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex-1 flex flex-col items-center py-2 px-1 rounded-2xl transition-all ${
                activeView === item.id 
                  ? 'text-purple-600 bg-purple-50 font-black scale-105 shadow-sm border border-purple-100' 
                  : 'text-slate-400 hover:text-purple-500'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-[10px] uppercase tracking-tighter font-black">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
