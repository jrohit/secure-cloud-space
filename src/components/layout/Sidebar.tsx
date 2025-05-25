
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
  Rocket, // Example icon for upgrade button
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth
import { useState } from 'react'; // Import useState
import { Button } from '@/components/ui/button'; // Import Button
import UpgradeStorageDialog from '@/components/dialogs/UpgradeStorageDialog'; // Import Dialog

interface SidebarProps {
  collapsed: boolean;
}

// Helper function (can be in utils.ts or locally in Sidebar.tsx)
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

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
  const { user } = useAuth(); // Get user from context
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false); // State for dialog

  const storagePercentage = user && typeof user.storageUsed === 'number' && typeof user.storageLimit === 'number' && user.storageLimit > 0
    ? (user.storageUsed / user.storageLimit) * 100
    : 0;

  return (
    <div
      className={cn(
        "border-r bg-background transition-all duration-300 overflow-hidden flex flex-col h-full", // Added flex flex-col h-full
        collapsed ? "w-0 md:w-14" : "w-64"
      )}
    >
      <div className="flex-grow space-y-4 py-4"> {/* Added flex-grow */}
        <div className="px-4 py-2">
          <h2 className={cn(
            "text-lg font-semibold tracking-tight transition-all duration-300",
            collapsed && "opacity-0 md:opacity-100 md:scale-0" // Keep original collapse behavior
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
      </div>
      {/* Storage Section - Placed at the bottom */}
      {user && typeof user.storageUsed === 'number' && typeof user.storageLimit === 'number' && (
        <div className={cn(
          "mt-auto p-4 border-t transition-opacity duration-300", // Use transition-opacity
          collapsed ? "opacity-0 pointer-events-none" : "opacity-100" // Control visibility with opacity
        )}>
          <h4 className="text-sm font-semibold mb-1">Storage</h4>
          <div className="text-xs text-muted-foreground">
            {formatBytes(user.storageUsed)} of {formatBytes(user.storageLimit)} used
          </div>
          <div className="w-full bg-secondary rounded-full h-2.5 mt-1">
            <div 
              className="bg-gradient-to-r from-cloudDrive-blue to-cloudDrive-green h-2.5 rounded-full" 
              style={{ width: `${storagePercentage}%` }}
            ></div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 w-full" 
            onClick={() => setIsUpgradeDialogOpen(true)}
          >
            <Rocket className="h-4 w-4 mr-2" /> 
            Upgrade Storage
          </Button>
        </div>
      )}
      <UpgradeStorageDialog 
        isOpen={isUpgradeDialogOpen} 
        onOpenChange={setIsUpgradeDialogOpen} 
      />
    </div>
  );
};
