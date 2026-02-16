'use client';

export function ProcessingIndicator() {
  return (
    <div className="flex justify-center py-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-xs text-muted-foreground/60 font-mono">Thinking...</span>
      </div>
    </div>
  );
}
