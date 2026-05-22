// Maps content icon keys -> Lucide SVG icons. Centralising this keeps
// marketing content free of emoji (per UI guidelines: SVG icons only)
// and gives every icon a consistent stroke width and size token.
import {
  Shield, Cpu, ClipboardCheck, Shuffle, BarChart3, Building2,
  Target, Lock, Handshake, Globe, FlaskConical, Wrench, Eye,
  FileText, Layers, Mail, Phone, MapPin, Check,
  type LucideIcon,
} from 'lucide-react'
import type { IconKey } from '@/lib/marketing-content'

const MAP: Record<IconKey, LucideIcon> = {
  shield: Shield,
  cpu: Cpu,
  clipboard: ClipboardCheck,
  shuffle: Shuffle,
  'bar-chart': BarChart3,
  building: Building2,
  target: Target,
  lock: Lock,
  handshake: Handshake,
  globe: Globe,
  flask: FlaskConical,
  wrench: Wrench,
  eye: Eye,
  'file-text': FileText,
  layers: Layers,
  mail: Mail,
  phone: Phone,
  'map-pin': MapPin,
  check: Check,
}

export function Icon({ name, size = 22, color, strokeWidth = 1.75 }: {
  name: IconKey
  size?: number
  color?: string
  strokeWidth?: number
}) {
  const Cmp = MAP[name] ?? Layers
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} aria-hidden />
}
