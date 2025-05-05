
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
  PlusCircle,
  Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { filesApi } from "@/services/api";
import { useEffect, useState } from "react";
import { StorageInfo } from "@/types";
import { Button } from "@/components/ui/button";
import UpgradeStorageDialog from "../storage/UpgradeStorageDialog";

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
  const { token } = useAuth();
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

  useEffect(() => {
    if (token) {
      loadStorageInfo();
    }
  }, [token]);

  const loadStorageInfo = async () => {
    if (!token) return;
    
    try {
      const info = await filesApi.getStorageInfo(token);
      setStorageInfo(info);
    } catch (error) {
      console.error("Error loading storage info:", error);
    }
  };

  const formatStorageSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    else return (bytes / 1073741824).toFixed(1) + " GB";
  };

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
          <SidebarItem icon={Search} label="Search" to="/dashboard/search" />
        </nav>
        <div className={cn(
          "px-3 py-2 transition-all duration-300",
          collapsed && "opacity-0"
        )}>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">Storage</div>
              {!collapsed && storageInfo && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs"
                  onClick={() => setIsUpgradeDialogOpen(true)}
                >
                  <PlusCircle className="h-3 w-3 mr-1" />
                  Upgrade
                </Button>
              )}
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cloudDrive-blue to-cloudDrive-green rounded-full" 
                  style={{ width: storageInfo ? `${Math.min(storageInfo.usagePercentage, 100)}%` : "0%" }}>
              </div>
            </div>
            {storageInfo && (
              <div className="text-xs text-muted-foreground">
                {formatStorageSize(storageInfo.storageUsed)} of {formatStorageSize(storageInfo.storageLimit)} used
              </div>
            )}
          </div>
        </div>
      </div>

      <UpgradeStorageDialog 
        open={isUpgradeDialogOpen}
        onOpenChange={setIsUpgradeDialogOpen}
        storageInfo={storageInfo || undefined}
        onUpgrade={loadStorageInfo}
      />
    </div>
  );
};
