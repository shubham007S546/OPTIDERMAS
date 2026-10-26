'use client'

import React from 'react'
import {
  LayoutDashboard,
  Camera,
  Clock,
  MessageSquare,
  Mic,
  BookOpen,
  FileText,
  FileSpreadsheet,
  Building2,
  CalendarCheck,
  ShieldCheck,
  Activity,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Stethoscope,
  X,
  ExternalLink,
} from 'lucide-react'

export type NavigationDestination =
  | 'dashboard'
  | 'analyze'
  | 'council'
  | 'history'
  | 'consult-chat'
  | 'consult-voice'
  | 'knowledge'
  | 'reports'
  | 'summaries'
  | 'care-connect'
  | 'appointments'
  | 'privacy'
  | 'status'

interface ClinicalSidebarProps {
  currentView: NavigationDestination
  onNavigate: (dest: NavigationDestination) => void
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  analysisAttached?: boolean
  recentCount?: number
}

interface NavItem {
  id: NavigationDestination
  label: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  badge?: string
  badgeVariant?: 'primary' | 'success' | 'warning' | 'info'
  sublabel?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

export function ClinicalSidebar({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  analysisAttached,
  recentCount,
}: ClinicalSidebarProps) {
  const navGroups: NavGroup[] = [
    {
      title: 'Main',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          sublabel: 'Clinical overview',
        },
        {
          id: 'analyze',
          label: 'New Skin Analysis',
          icon: Camera,
          badge: analysisAttached ? 'Ready' : undefined,
          badgeVariant: 'primary',
          sublabel: 'Inference & XAI',
        },
        {
          id: 'history',
          label: 'Analysis History',
          icon: Clock,
          badge: recentCount !== undefined && recentCount > 0 ? String(recentCount) : undefined,
          badgeVariant: 'info',
          sublabel: 'Persisted cases',
        },
      ],
    },
    {
      title: 'AI Consultation',
      items: [
        {
          id: 'council',
          label: 'Multi-Agent Council',
          icon: Sparkles,
          badge: '7 Agents',
          badgeVariant: 'primary',
          sublabel: 'Consensus & Deliberation',
        },
        {
          id: 'consult-chat',
          label: 'AI Dermatology Chat',
          icon: MessageSquare,
          badge: '10x RAG',
          badgeVariant: 'primary',
          sublabel: '48+ Guidelines Grounded',
        },
        {
          id: 'knowledge',
          label: 'Knowledge Base',
          icon: BookOpen,
          sublabel: 'Clinical literature',
        },
      ],
    },
    {
      title: 'Clinical Workspace',
      items: [
        {
          id: 'reports',
          label: 'Reports & Audits',
          icon: FileText,
          sublabel: 'PDF & verification',
        },
        {
          id: 'summaries',
          label: 'Consultation Summaries',
          icon: FileSpreadsheet,
          sublabel: 'Pre-visit packets',
        },
        {
          id: 'care-connect',
          label: 'Care Connect',
          icon: Building2,
          sublabel: 'Dermatologist directory',
        },
        {
          id: 'appointments',
          label: 'Appointment Requests',
          icon: CalendarCheck,
          sublabel: 'Status tracking',
        },
      ],
    },
    {
      title: 'System & Privacy',
      items: [
        {
          id: 'privacy',
          label: 'Data & Privacy Controls',
          icon: ShieldCheck,
          sublabel: 'Local SQLite & encryption',
        },
        {
          id: 'status',
          label: 'System Diagnostics',
          icon: Activity,
          sublabel: 'PyTorch & services',
        },
      ],
    },
  ]

  const handleItemClick = (id: NavigationDestination) => {
    onNavigate(id)
    if (mobileOpen) {
      onCloseMobile()
    }
  }

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out shadow-xs lg:shadow-none select-none ${
          mobileOpen ? 'translate-x-0 w-80' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-[76px]' : 'lg:w-[290px]'}`}
      >
        {/* Sidebar Header: Logo & Branding */}
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <button
            onClick={() => handleItemClick('dashboard')}
            className={`flex items-center gap-3 text-left focus:outline-none group ${
              collapsed ? 'justify-center w-full' : ''
            }`}
            title="OptiDerma Dashboard"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-900 text-white flex items-center justify-center shadow-xs shadow-blue-900/20 ring-1 ring-white/30 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" className="stroke-white/40" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="5" className="stroke-white" strokeWidth="2" />
                <line x1="12" y1="2" x2="12" y2="6" strokeWidth="2" />
                <line x1="12" y1="18" x2="12" y2="22" strokeWidth="2" />
                <line x1="2" y1="12" x2="6" y2="12" strokeWidth="2" />
                <line x1="18" y1="12" x2="22" y2="12" strokeWidth="2" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </div>
            {!collapsed && (
              <div className="overflow-hidden leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-black tracking-tight text-slate-950 text-[15px]">OPTIDERMA</span>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white tracking-wider shadow-2xs">
                    PRO
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium tracking-tight truncate">
                  Clinical Decision Support
                </p>
              </div>
            )}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 scrollbar-thin">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {!collapsed && (
                <div className="px-3 pb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>
              )}
              {collapsed && (
                <div className="w-8 h-px bg-slate-200 mx-auto my-2" />
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = currentView === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      title={collapsed ? `${item.label} (${item.sublabel})` : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative ${
                        isActive
                          ? 'bg-blue-50 text-blue-900 border border-blue-200/90 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                      } ${collapsed ? 'justify-center px-0 py-3' : ''}`}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-blue-700" />
                      )}

                      <Icon
                        size={18}
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? 'text-blue-700'
                            : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                      />

                      {!collapsed && (
                        <div className="flex-1 text-left flex items-center justify-between min-w-0">
                          <span className="font-semibold text-slate-700 whitespace-nowrap">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider ${
                                item.badgeVariant === 'success'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : item.badgeVariant === 'warning'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : item.badgeVariant === 'primary'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer: System Persistence & Collapse Toggle */}
        <div className="p-4 pb-5 border-t border-slate-200 bg-slate-50/80 shrink-0">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100 shrink-0" />
                  <span className="text-xs font-bold text-slate-800">Local SQLite DB</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  Session Verified • TLS Active
                </p>
              </div>

              {/* Desktop Collapse Toggle */}
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"
                title="Local Database Store Online"
              />
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white transition-colors"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
