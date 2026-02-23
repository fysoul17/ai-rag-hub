import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Calendar,
  Clock,
  Code,
  Database,
  FileText,
  Globe,
  Home,
  Layers,
  Layout,
  LineChart,
  Mail,
  MessageSquare,
  Settings,
  Shield,
  Table,
  Users,
  Zap,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Calendar,
  Clock,
  Code,
  Database,
  FileText,
  Globe,
  Home,
  Layers,
  Layout,
  LineChart,
  Mail,
  MessageSquare,
  Settings,
  Shield,
  Table,
  Users,
  Zap,
};

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? FileText;
}
