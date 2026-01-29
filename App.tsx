import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsDrawer } from './components/SettingsDrawer';
import { useAppStore } from './store/useAppStore';

const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { createConversation, activeConversationId } = useAppStore();

  useEffect(() => {
    // Initialize a conversation if none exists
    if (!activeConversationId) {
      createConversation();
    }
  }, [activeConversationId, createConversation]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />
      
      <main className="flex-1 relative flex flex-col min-w-0">
        <ChatArea />
      </main>

      <SettingsDrawer 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};

export default App;