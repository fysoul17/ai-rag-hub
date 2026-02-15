import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function Header({ title }: { title: string }) {
  return (
    <header className="flex h-12 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger className="text-muted-foreground hover:text-primary" />
      <Separator orientation="vertical" className="h-5" />
      <h1 className="text-sm font-medium tracking-wide">{title}</h1>
    </header>
  );
}
