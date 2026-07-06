import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Kanban,
  Activity,
  Settings,
  Code,
  FileText,
  Zap,
  BarChart3,
  Server,
  Briefcase,
  Globe,
  CheckCircle,
  Rocket,
} from 'lucide-react';
import { cn } from '../../utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/operations', icon: Briefcase, label: 'Operations' },
  { to: '/actions', icon: Zap, label: 'Acciones' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/analytics', icon: BarChart3, label: 'Analíticas' },
  { to: '/validation', icon: CheckCircle, label: 'Validation' },
  { to: '/deployment', icon: Rocket, label: 'Deployment' },
  { to: '/system', icon: Server, label: 'System' },
  { to: '/website-integration', icon: Globe, label: 'Integration' },
  { to: '/settings', icon: Settings, label: 'Config' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">JMAXX</h1>
            <p className="text-xs text-slate-400 -mt-0.5">Lead Intelligence</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-3 border-t border-slate-700">
        <div className="px-3 py-2">
          <p className="text-xs text-slate-400">Versión</p>
          <p className="text-sm font-medium text-slate-200">Sprint 7 - Operations</p>
        </div>
      </div>
    </aside>
  );
}
