import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  users: { userId: string; displayName: string }[];
  className?: string;
}

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const getText = () => {
    if (users.length === 1) {
      return `${users[0].displayName} is typing`;
    } else if (users.length === 2) {
      return `${users[0].displayName} and ${users[1].displayName} are typing`;
    } else {
      return `${users.length} people are typing`;
    }
  };

  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground text-sm animate-fade-in", className)}>
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span>{getText()}</span>
    </div>
  );
}
