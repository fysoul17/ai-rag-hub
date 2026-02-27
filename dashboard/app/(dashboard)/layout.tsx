import { Toaster } from 'sonner';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { isAuthEnabled } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = isAuthEnabled();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar authEnabled={authEnabled} />
        <main className="relative flex-1 overflow-auto">{children}</main>
      </SidebarProvider>
      <Toaster
        richColors
        theme="dark"
        position="bottom-right"
        toastOptions={{ className: 'glass' }}
      />
    </TooltipProvider>
  );
}
