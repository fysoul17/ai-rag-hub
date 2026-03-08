const statusColors: Record<string, string> = {
  ok: 'bg-neon-green',
  degraded: 'bg-neon-amber',
  error: 'bg-neon-red',
};

export function HealthIndicator({ status }: { status: string }) {
  const color = statusColors[status] ?? statusColors.error;

  return (
    <span className="relative flex h-3 w-3">
      <span
        className={`absolute inline-flex h-full w-full animate-pulse-glow rounded-full opacity-75 ${color}`}
      />
      <span className={`relative inline-flex h-3 w-3 rounded-full ${color}`} />
    </span>
  );
}
