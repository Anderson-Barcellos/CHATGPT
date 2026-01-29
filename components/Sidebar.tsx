import React from 'react';
import { MessageSquare, Plus, Settings, Image as ImageIcon, FileText, Monitor, ChevronRight, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AppMode } from '../types';

interface SidebarProps {
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings }) => {
  const { 
    conversations, 
    activeConversationId, 
    activeMode, 
    setActiveMode, 
    createConversation, 
    selectConversation,
    deleteConversation 
  } = useAppStore();

  const handleNewChat = () => {
    createConversation();
  };

  const handleModeSwitch = (mode: AppMode) => {
    setActiveMode(mode);
    // Optionally create a new chat for the mode or switch context
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full">
      {/* Header / Mode Switcher */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="flex items-center gap-2 font-bold text-xl px-2">
           <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
             N
           </div>
           <span>NexusAI</span>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-lg">
          <button 
            onClick={() => handleModeSwitch('chat')}
            className={`p-1.5 rounded-md flex justify-center items-center transition-all ${activeMode === 'chat' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="Chat Mode"
          >
            <MessageSquare size={16} />
          </button>
          <button 
             onClick={() => handleModeSwitch('image')}
             className={`p-1.5 rounded-md flex justify-center items-center transition-all ${activeMode === 'image' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
             title="Image Mode"
          >
            <ImageIcon size={16} />
          </button>
          <button 
             onClick={() => handleModeSwitch('canvas')}
             className={`p-1.5 rounded-md flex justify-center items-center transition-all ${activeMode === 'canvas' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
             title="Canvas Mode"
          >
            <Monitor size={16} />
          </button>
        </div>

        <button 
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 bg-primary text-primary-foreground hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          History
        </div>
        <div className="space-y-1 px-2">
          {conversations.length === 0 && (
            <p className="px-4 text-sm text-muted-foreground italic">No conversations yet.</p>
          )}
          {conversations.map((conv) => (
            <div 
              key={conv.id}
              className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors ${
                activeConversationId === conv.id 
                  ? 'bg-muted text-foreground' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              onClick={() => selectConversation(conv.id)}
            >
               <span className="truncate flex-1 pr-2">{conv.title}</span>
               <button 
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
               >
                 <Trash2 size={12} />
               </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full px-2 py-2 rounded-md hover:bg-muted/50"
        >
          <Settings size={16} /> Settings & Memories
        </button>
      </div>
    </div>
  );
};