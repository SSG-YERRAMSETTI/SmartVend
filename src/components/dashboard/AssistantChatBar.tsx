import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Send, CheckCircle2, X } from "lucide-react";
import {
  useAssistantChat, useExecuteAssistantAction, ChatMessage, PendingAction,
} from "@/hooks/useApi";

const SUGGESTIONS = [
  "What's low on stock?",
  "Any purchases waiting for review?",
  "What's expiring soon?",
  "Take me to Reports",
];

export function AssistantChatBar() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const chat = useAssistantChat();
  const executeAction = useExecuteAssistantAction();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pendingAction]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setPendingAction(null);
    chat.mutate(next, {
      onSuccess: (res) => {
        setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
        if (res.pending_action) setPendingAction(res.pending_action);
        if (res.navigate) navigate(res.navigate);
      },
      onError: () => {
        setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong reaching the assistant. Is GEMINI_API_KEY set in backend/.env?" }]);
      },
    });
  };

  const confirmAction = () => {
    if (!pendingAction) return;
    executeAction.mutate(
      { name: pendingAction.name, args: pendingAction.args },
      {
        onSuccess: (res) => {
          setMessages((prev) => [...prev, { role: "assistant", content: `✅ ${res.reply}` }]);
          setPendingAction(null);
        },
        onError: () => {
          setMessages((prev) => [...prev, { role: "assistant", content: "That action failed — nothing was changed." }]);
          setPendingAction(null);
        },
      }
    );
  };

  return (
    <Card className="flex flex-col h-full">
      <CardContent className="p-4 flex flex-col h-full gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="font-medium text-sm">Assistant</p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 min-h-[160px] max-h-[320px]">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Ask about your business, or tell it where to go.</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-2 py-1 rounded-full border hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm rounded-lg px-3 py-2 max-w-[90%] ${
                m.role === "user" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"
              }`}
            >
              {m.content}
            </div>
          ))}
          {chat.isPending && <div className="text-sm text-muted-foreground px-3">Thinking...</div>}
          {pendingAction && (
            <div className="border rounded-lg p-3 bg-amber-50 border-amber-200 space-y-2">
              <p className="text-sm font-medium">{pendingAction.label}</p>
              <p className="text-xs text-muted-foreground">This will actually update your data. Confirm?</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmAction} disabled={executeAction.isPending}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPendingAction(null)}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the assistant..."
            disabled={chat.isPending}
          />
          <Button type="submit" size="icon" disabled={chat.isPending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
