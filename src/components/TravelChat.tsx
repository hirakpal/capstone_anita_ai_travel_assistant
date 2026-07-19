import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, MessageSquare, CornerDownLeft, Loader, Compass, ShieldAlert, Leaf, Coins, Utensils } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TravelState } from "../types.ts";

interface Message {
  role: "user" | "assistant";
  content: string;
  fromCache?: boolean;
}

interface TravelChatProps {
  state: TravelState;
  mode?: "Online" | "Demo";
}

export default function TravelChat({ state, mode }: TravelChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I am **ANITA**, your travel swarm coordinator. 

I have synchronized my micro-agents (Flight, Hotel, Transit, activity, and Food) for your upcoming journey from **${state.origin}** to **${state.destination}**. 

How can I assist you with your travel plans, budget swaps, safety, or carbon offset recommendations today?`
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const presets = [
    { label: "🌱 Reduce Carbon Score", text: "How can I reduce the carbon score and make this trip more sustainable?" },
    { label: "🌤️ Weather Warnings", text: "Are there any weather alerts or temperature warnings for my destination?" },
    { label: "💸 Lower-Budget Swaps", text: "Suggest some cost-saving hotel and transit alternatives to lower the budget." },
    { label: "🍴 Local Food Recommendations", text: "What are some highly-rated authentic restaurants matching my cuisine preferences?" }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content
          })),
          state,
          mode
        })
      });

      if (!response.ok) {
        throw new Error("Chat service returned an error.");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, fromCache: data.fromCache }]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Sorry, I encountered an issue coordinating with the travel agents. Please verify your internet connection or check if the Gemini API Key is configured."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[520px] border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden shadow-xs">
      {/* CHAT HEADER */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8.5 w-8.5 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 font-display flex items-center gap-1">
              ANITA Travel Swarm Chat
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Origin: {state.origin} &rarr; Destination: {state.destination}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] bg-indigo-50 text-indigo-700 font-mono font-bold px-2.5 py-1 rounded-md border border-indigo-100">
          <Sparkles className="h-3 w-3" />
          ACTIVE AGENTS
        </div>
      </div>

      {/* CHAT MESSAGES PANEL */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white rounded-tr-none font-medium"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none whitespace-pre-wrap"
                }`}
              >
                {msg.fromCache && (
                  <div className="flex items-center gap-1 mb-1.5 text-[9px] font-extrabold text-indigo-750 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md w-fit font-mono select-none">
                    <Coins className="h-2.5 w-2.5" />
                    CACHED ANSWER • SAVED TOKENS
                  </div>
                )}
                {/* Basic format parsing for markdown bolding/lists to render beautifully */}
                {msg.content.split("\n").map((line, i) => {
                  let parsedLine = line;
                  // Handle list items
                  const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("* ");
                  if (isBullet) {
                    parsedLine = line.trim().substring(2);
                  }

                  // Handle bolding formatting
                  const boldRegex = /\*\*(.*?)\*\*/g;
                  const parts = [];
                  let lastIndex = 0;
                  let match;

                  while ((match = boldRegex.exec(parsedLine)) !== null) {
                    if (match.index > lastIndex) {
                      parts.push(parsedLine.substring(lastIndex, match.index));
                    }
                    parts.push(<strong key={match.index} className="font-extrabold text-slate-950 dark:text-inherit">{match[1]}</strong>);
                    lastIndex = boldRegex.lastIndex;
                  }
                  if (lastIndex < parsedLine.length) {
                    parts.push(parsedLine.substring(lastIndex));
                  }

                  return (
                    <div key={i} className={isBullet ? "flex items-start gap-1.5 pl-2 mt-1" : "mt-0.5"}>
                      {isBullet && <span className="text-indigo-500 shrink-0 select-none">•</span>}
                      <span>{parts.length > 0 ? parts : parsedLine}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
                <Loader className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                <span>Consulting travel agent swarm...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* QUICK PRESETS */}
      <div className="px-4 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {presets.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(preset.text)}
            className="bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* INPUT CONTROLS */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 rounded-xl px-3 py-2 transition-all"
        >
          <input
            id="chat-input-field"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask ANITA (e.g., 'What eco-alternatives do we have?')"
            className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 font-medium focus:outline-none pr-10"
          />
          <button
            id="chat-send-btn"
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 transition-all cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
