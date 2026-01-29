

import React, { useEffect, useRef, useState } from 'react';
import { Send, Square, Bot, Sparkles, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { generateStream, generateImage } from '../services/openaiService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { IMAGE_MODEL_OPTIONS, MODEL_OPTIONS } from '../types';

// AI Logo
const AssistantLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M22.2819 9.82116C22.1842 9.49625 21.6883 7.82855 20.3704 6.2736C19.0435 4.7076 17.0673 3.69345 15.1102 3.16104C13.1491 2.62734 11.2374 2.82283 10.3204 3.06412C10.2794 3.07474 10.2374 3.08535 10.1963 3.09724C10.1942 3.09724 10.1921 3.09848 10.19 3.09848C10.0939 3.12595 7.02706 4.02008 5.43444 6.6432C3.84052 9.26757 3.86971 12.8687 4.01777 13.9114C4.01984 13.9264 4.0219 13.9401 4.02397 13.9551L4.02086 13.9563C4.12051 14.2887 4.63066 15.9961 5.96989 17.5586C7.30913 19.1211 9.29462 20.129 11.2343 20.6548C11.6667 20.7722 12.1065 20.8309 12.5411 20.8309C14.0754 20.8309 15.5393 20.2638 16.7126 19.2486C16.8298 19.1475 19.8252 16.4944 20.2452 13.5681C20.6652 10.6405 19.1929 7.74989 19.167 7.70119L22.2819 9.82116ZM11.9682 17.2028C10.6683 16.8494 9.42392 16.0353 8.52695 14.8516C7.57508 13.5954 7.21855 12.1095 7.15233 11.2367C7.33962 11.3977 7.54555 11.5363 7.76698 11.6499C7.79598 11.6649 7.82604 11.6786 7.85504 11.6936C9.17631 12.3654 10.7439 12.3617 12.0621 11.6849L15.9084 9.69255L14.7576 15.758C14.3464 16.6345 13.2681 17.5562 11.9682 17.2028ZM8.34796 8.56711C8.75916 7.69062 9.83742 6.76891 11.1373 7.12231C12.4372 7.47571 13.6816 8.28981 14.5786 9.47348C15.5305 10.7297 15.887 12.2156 15.9532 13.0883C15.7659 12.9273 15.56 12.7887 15.3386 12.6751C15.3095 12.6601 15.2795 12.6464 15.2505 12.6314C13.9292 11.9596 12.3616 11.9634 11.0434 12.6401L7.19714 14.6325L8.34796 8.56711Z" />
  </svg>
);

export const ChatArea: React.FC = () => {
  const { 
    conversations, 
    activeConversationId, 
    activeMode,
    settings,
    updateSettings,
    memories,
    addMessage, 
    updateMessageContent, 
    setStreamingStatus 
  } = useAppStore();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, activeConversation?.messages[activeConversation?.messages.length - 1]?.content]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSubmit = async () => {
    if (!input.trim() || !activeConversationId || isProcessing) return;
    
    const userPrompt = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsProcessing(true);

    const history = activeConversation?.messages || [];
    addMessage(activeConversationId, 'user', userPrompt);

    const assistantMsg = addMessage(activeConversationId, 'assistant', '');

    try {
      if (activeMode === 'image') {
        updateMessageContent(activeConversationId, assistantMsg.id, "Generating artwork with OpenAI...");
        const result = await generateImage(userPrompt, settings);
        const content = `![Generated Image](${result.url})\n\n*Generated with OpenAI*`;
        updateMessageContent(activeConversationId, assistantMsg.id, content);
      } else {
        await generateStream(
          history, 
          userPrompt,
          settings,
          memories,
          (chunk) => {
            updateMessageContent(activeConversationId, assistantMsg.id, chunk);
          }
        );
      }
    } catch (error) {
       updateMessageContent(activeConversationId, assistantMsg.id, `**Error:** Failed to generate response. ${error}`);
    } finally {
      setStreamingStatus(activeConversationId, assistantMsg.id, false);
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50 dark:from-gray-900 dark:via-slate-900 dark:to-blue-950">
        <p>Select or create a conversation to begin.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50 dark:from-gray-900 dark:via-slate-900 dark:to-blue-950 transition-all relative">
      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto p-4 md:p-8 space-y-6 ${activeMode === 'canvas' ? 'grid grid-cols-2 gap-4' : ''}`}>
        
        <div className={`space-y-6 ${activeMode === 'canvas' ? 'col-span-1 border-r border-border pr-4' : ''}`}>
          {activeConversation.messages.map((msg, idx) => (
            <div 
              key={msg.id} 
              className={`flex gap-4 animate-fade-in-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{ animationDelay: `${idx * 0.05}ms` }}
            >
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-white dark:bg-black border border-border flex items-center justify-center shadow-sm shrink-0 mt-1">
                   <AssistantLogo className={`w-5 h-5 text-black dark:text-white ${msg.isStreaming ? 'animate-pulse' : ''}`} />
                </div>
              )}

              <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm relative group transition-all duration-300 ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-none' 
                  : 'bg-white/80 dark:bg-card/80 backdrop-blur-sm border border-border text-foreground rounded-bl-none hover:shadow-md'
              }`}>
                {msg.role === 'assistant' && activeMode === 'image' && msg.content.includes('data:image') ? (
                   <div className="space-y-2">
                      <img 
                        src={msg.content.match(/\((data:image.*)\)/)?.[1]} 
                        alt="Generated" 
                        className="rounded-lg max-w-full h-auto border border-border/50 shadow-md"
                      />
                   </div>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}
                
                {msg.isStreaming && (
                  <div className="flex gap-1 mt-2">
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {activeMode === 'canvas' && (
          <div className="hidden md:flex flex-col bg-[#1e1e1e] rounded-xl border border-border overflow-hidden shadow-2xl">
             <div className="bg-[#2d2d2d] p-3 px-4 text-xs font-mono text-gray-300 border-b border-black flex justify-between items-center">
                <span className="flex items-center gap-2"><Square size={12} className="text-blue-400"/> CANVAS PREVIEW</span>
                <span className="opacity-50">READ-ONLY</span>
             </div>
             <div className="flex-1 p-4 font-mono text-sm text-gray-300 overflow-auto">
               <pre className="text-sm">
{`// Code Context (${settings.model})
// The output here reflects generated artifacts.

function Example() {
  return <div>Use 'Canvas' mode for coding tasks.</div>
}`}
               </pre>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background/50 backdrop-blur-md border-t border-border z-10">
        <div className="max-w-4xl mx-auto relative bg-card/50 backdrop-blur-xl rounded-2xl border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 focus-within:bg-card transition-all shadow-lg">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
                activeMode === 'image' ? "Describe the image to create..." :
                "Message NexusAI..."
            }
            className="w-full bg-transparent border-none focus:ring-0 resize-none p-4 max-h-[200px] min-h-[56px] outline-none text-base"
            rows={1}
          />
          
          <div className="flex justify-between items-center px-2 pb-2">
             <div className="flex gap-2 pl-2 items-center">
               
               {/* Model Selector Dropdown */}
               <div className="relative group">
                 <select 
                    value={settings.model}
                    onChange={(e) => updateSettings({ model: e.target.value })}
                    className="appearance-none bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full py-1.5 pl-3 pr-8 text-xs font-medium cursor-pointer hover:bg-blue-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                 >
                   {MODEL_OPTIONS.map(opt => (
                     <option key={opt.id} value={opt.id} className="bg-card text-foreground">
                       {opt.name}
                     </option>
                   ))}
                 </select>
                 <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
               </div>

                {activeMode === 'image' ? (
                  <div className="relative group hidden sm:block">
                    <select
                      value={settings.imageModel ?? 'gpt-image-1'}
                      onChange={(e) => updateSettings({ imageModel: e.target.value })}
                      className="appearance-none bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-full py-1.5 pl-3 pr-8 text-xs font-medium cursor-pointer hover:bg-purple-500/20 transition-colors"
                    >
                      {IMAGE_MODEL_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id} className="bg-card text-foreground">
                          {opt.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                  </div>
                ) : (
                  <div className="text-xs px-2 py-1 rounded-full border opacity-70 hidden sm:block bg-zinc-500/10 text-zinc-500 border-zinc-500/20">
                    Chat
                  </div>
                )}
             </div>

            <button 
              onClick={handleSubmit}
              disabled={!input.trim() || isProcessing}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                input.trim() && !isProcessing 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
              }`}
            >
              {isProcessing ? <Square size={18} className="animate-pulse" /> : <Send size={18} />}
            </button>
          </div>
        </div>
        <div className="text-center mt-2">
           <p className="text-[10px] text-muted-foreground/60">Powered by OpenAI. AI can make mistakes.</p>
        </div>
      </div>
    </div>
  );
};
