
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";
import {
  Home,
  FolderOpen,
  FileText,
  Star,
  Trash2,
  Share,
  Settings,
  HardDrive,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
}

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  color?: string;
}

const SidebarItem = ({ icon: Icon, label, to, color }: SidebarItemProps) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent",
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )
    }
  >
    <Icon
      style={color ? { color } : {}}
      className="h-4 w-4"
    />
    <span>{label}</span>
  </NavLink>
);

export const Sidebar = ({ collapsed }: SidebarProps) => {
  return (
    <div
      className={cn(
        "border-r bg-background transition-all duration-300 overflow-hidden",
        collapsed ? "w-0 md:w-14" : "w-64"
      )}
    >
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <h2 className={cn(
            "text-lg font-semibold tracking-tight transition-all duration-300",
            collapsed && "opacity-0 md:opacity-100 md:scale-0"
          )}>
            My Drive
          </h2>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          <SidebarItem icon={Home} label="Home" to="/dashboard" />
          <SidebarItem icon={HardDrive} label="My Drive" to="/dashboard/my-drive" color="#4285F4" />
          <SidebarItem icon={FileText} label="Recent" to="/dashboard/recent" />
          <SidebarItem icon={Star} label="Starred" to="/dashboard/starred" color="#FBBC05" />
          <SidebarItem icon={Share} label="Shared" to="/dashboard/shared" />
          <SidebarItem icon={Trash2} label="Trash" to="/dashboard/trash" color="#EA4335" />
          <div className="my-2 border-t border-border" />
          <SidebarItem icon={Settings} label="Settings" to="/dashboard/settings" />
        </nav>
        <div className={cn(
          "px-3 py-2 transition-all duration-300",
          collapsed && "opacity-0"
        )}>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Storage</div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cloudDrive-blue to-cloudDrive-green rounded-full" style={{ width: "35%" }}></div>
            </div>
            <div className="text-xs text-muted-foreground">3.5 GB of 10 GB used</div>
          </div>
        </div>
      </div>
    </div>
  );
};
