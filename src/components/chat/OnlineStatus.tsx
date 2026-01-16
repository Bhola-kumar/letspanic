import { cn } from "@/lib/utils";

interface OnlineStatusProps {
  isOnline: boolean;
  lastSeen?: string | null;
  className?: string;
  showText?: boolean;
}

export function OnlineStatus({ isOnline, lastSeen, className, showText = true }: OnlineStatusProps) {
  const formatLastSeen = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0",
          isOnline ? "bg-[hsl(var(--online))]" : "bg-[hsl(var(--offline))]"
        )}
      />
      {showText && (
        <span className="text-xs text-muted-foreground">
          {isOnline ? "Online" : lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : "Offline"}
        </span>
      )}
    </div>
  );
}
