
import React from 'react';
import { X, Brain, Sliders, User, Plus, Trash2, Gauge } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ReasoningEffort } from '../types';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, memories, addMemory, toggleMemory, removeMemory } = useAppStore();
  const [newMemory, setNewMemory] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'params' | 'memory' | 'system'>('params');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
        <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Configuration</h2>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex border-b border-border p-1 mx-4 mt-4 bg-muted/30 rounded-lg">
        <button 
          onClick={() => setActiveTab('params')}
          className={`flex-1 p-2 text-xs font-medium rounded-md transition-all ${activeTab === 'params' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Tuning
        </button>
        <button 
          onClick={() => setActiveTab('memory')}
          className={`flex-1 p-2 text-xs font-medium rounded-md transition-all ${activeTab === 'memory' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Memory
        </button>
        <button 
          onClick={() => setActiveTab('system')}
          className={`flex-1 p-2 text-xs font-medium rounded-md transition-all ${activeTab === 'system' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Persona
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {activeTab === 'params' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300 mb-4">
               Current Model: <span className="font-bold">{settings.model}</span>
               <div className="text-xs opacity-70 mt-1">Change model in the chat input area.</div>
            </div>

             <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Temperature</label>
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{settings.temperature}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="2" 
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:accent-blue-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Reasoning Effort</label>
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{settings.reasoningEffort}</span>
                </div>
                <select
                  value={settings.reasoningEffort}
                  onChange={(e) => updateSettings({ reasoningEffort: e.target.value as ReasoningEffort })}
                  className="w-full bg-input border border-border rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="none">None</option>
                  <option value="minimal">Minimal</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Top P</label>
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{settings.topP}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={settings.topP}
                  onChange={(e) => updateSettings({ topP: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:accent-blue-400"
                />
              </div>
            </div>

             <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-muted-foreground">Max Tokens</label>
                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{settings.maxOutputTokens}</span>
              </div>
              <input 
                type="range" 
                min="256" 
                max="8192" 
                step="256"
                value={settings.maxOutputTokens}
                onChange={(e) => updateSettings({ maxOutputTokens: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:accent-blue-400"
              />
            </div>
          </div>
        )}

        {/* ... (Memory and System tabs remain similar) ... */}
        {activeTab === 'memory' && (
          <div className="space-y-4 animate-fade-in-up">
             <div className="flex gap-2">
               <input 
                  type="text"
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  placeholder="e.g. Always explain code in detail..."
                  className="flex-1 bg-input border border-border rounded-lg p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMemory.trim()) {
                      addMemory(newMemory, 'personal');
                      setNewMemory('');
                    }
                  }}
               />
               <button 
                onClick={() => {
                  if (newMemory.trim()) {
                    addMemory(newMemory, 'personal');
                    setNewMemory('');
                  }
                }}
                className="p-3 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors"
               >
                 <Plus size={18} />
               </button>
             </div>

             <div className="space-y-2 mt-4">
               {memories.length === 0 && (
                 <div className="text-center py-8 opacity-50 border-2 border-dashed border-border rounded-lg">
                    <Brain className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No memories stored.</p>
                 </div>
               )}
               {memories.map(m => (
                 <div key={m.id} className="flex items-start gap-3 bg-muted/40 p-3 rounded-lg group hover:bg-muted/60 transition-colors border border-transparent hover:border-border">
                   <input 
                    type="checkbox"
                    checked={m.isActive}
                    onChange={() => toggleMemory(m.id)}
                    className="mt-1 accent-primary"
                   />
                   <p className={`flex-1 text-sm leading-relaxed ${!m.isActive ? 'opacity-50 line-through' : ''}`}>{m.content}</p>
                   <button 
                    onClick={() => removeMemory(m.id)}
                    className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                   >
                     <Trash2 size={14} />
                   </button>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Brain size={14} /> Core System Instruction
              </label>
              <textarea 
                value={settings.systemInstruction}
                onChange={(e) => updateSettings({ systemInstruction: e.target.value })}
                rows={4}
                className="w-full bg-input border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User size={14} /> About User Context
              </label>
              <textarea 
                value={settings.contextAboutUser}
                onChange={(e) => updateSettings({ contextAboutUser: e.target.value })}
                placeholder="What should the AI know about you?"
                rows={3}
                className="w-full bg-input border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Sliders size={14} /> Custom Response Instructions
              </label>
              <textarea 
                value={settings.responsePreferences}
                onChange={(e) => updateSettings({ responsePreferences: e.target.value })}
                placeholder="e.g. Be concise, use technical jargon..."
                rows={3}
                className="w-full bg-input border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none transition-all"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
