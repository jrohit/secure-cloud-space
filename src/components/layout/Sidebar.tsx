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
import { useState } from "react"; // Import useState
import { Button } from "@/components/ui/button";
import UpgradeStorageDialog from "@/components/dialogs/UpgradeStorageDialog";
import { ThemeToggle } from "./ThemeToggle"; // Added

interface SidebarProps {
  collapsed: boolean;
}

// Helper function (can be in utils.ts or locally in Sidebar.tsx)
const formatBytes = (
  bytes: number | null | undefined,
  decimals = 2,
): string => {
  if (
    bytes === null ||
    bytes === undefined ||
    typeof bytes !== "number" ||
    isNaN(bytes)
  ) {
    return "N/A"; // Handles null, undefined, non-numbers, NaN
  }

  if (bytes < 0) {
    // Specifically handle negative numbers
    return "0 Bytes"; // Or 'N/A', or 'Invalid Value' depending on desired display for negative
  }

  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]; // Added more sizes

  // Prevent errors from Math.log(0) or Math.log(negative)
  // The initial checks for bytes === 0 and bytes < 0 already handle these.

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Handle cases where bytes is < 1 (but not 0 or negative), making i negative
  // This shouldn't happen with storage sizes but makes the function generally robust.
  if (i < 0) {
    // This case implies bytes is > 0 but < 1.
    // For storage, this is unlikely. We can just show it as Bytes.
    // Or, if we want to be super precise for small fractional bytes (not typical for this app):
    // return parseFloat(bytes.toFixed(dm)) + ' Bytes';
    // Given the context, if it ever reached here for storage, it's likely a data anomaly.
    // Returning "N/A" or "Error" might be better if i is unexpectedly negative.
    // However, for positive bytes < 1, Math.log(bytes) is negative, so i would be negative.
    // e.g. 0.5 bytes. log(0.5) / log(1024) = negative. sizes[negative_index] is error.
    // Let's return Bytes for any value < 1KB but > 0.
    if (bytes > 0 && bytes < k) {
      return parseFloat(bytes.toFixed(dm)) + " Bytes";
    }
    // If it's still negative 'i' for other reasons (highly unlikely with prior checks)
    return "N/A";
  }

  // Ensure 'i' is within the bounds of the 'sizes' array
  if (i >= sizes.length) {
    // Handle extremely large numbers beyond Yottabytes
    return (
      parseFloat((bytes / Math.pow(k, sizes.length - 1)).toFixed(dm)) +
      " " +
      sizes[sizes.length - 1]
    );
  }

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  colorClassName?: string; // Changed from color to colorClassName
}

const SidebarItem = ({
  icon: Icon,
  label,
  to,
  colorClassName,
}: SidebarItemProps) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent",
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
      )
    }
  >
    <Icon
      className={cn("h-4 w-4", colorClassName)} // Apply colorClassName here
    />
    <span>{label}</span>
  </NavLink>
);

export const Sidebar = ({ collapsed }: SidebarProps) => {
  const { user } = useAuth(); // Get user from context
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false); // State for dialog

  const storagePercentage =
    user &&
    typeof user.storageUsed === "number" &&
    typeof user.storageLimit === "number" &&
    user.storageLimit > 0
      ? (user.storageUsed / user.storageLimit) * 100
      : 0;

  // Inside Sidebar component, before the return statement or storage section:
  if (user) {
    console.log(
      "Sidebar - user.storageUsed:",
      user.storageUsed,
      "type:",
      typeof user.storageUsed,
    );
    console.log(
      "Sidebar - user.storageLimit:",
      user.storageLimit,
      "type:",
      typeof user.storageLimit,
    );
  }

  return (
    <div
      className={cn(
        "sticky top-0 border-r bg-background transition-all duration-300 overflow-hidden flex flex-col h-full", // Added flex flex-col h-full
        collapsed ? "w-0 md:w-14" : "w-64",
      )}
    >
      <div className="flex-grow space-y-4 py-4">
        {" "}
        {/* Added flex-grow */}
        <div className="px-4 py-2">
          <h2
            className={cn(
              "text-lg font-semibold tracking-tight transition-all duration-300",
              collapsed && "opacity-0 md:opacity-100 md:scale-0", // Keep original collapse behavior
            )}
          >
            My Drive
          </h2>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          <SidebarItem icon={Home} label="Home" to="/dashboard" />
          <SidebarItem
            icon={HardDrive}
            label="My Drive"
            to="/dashboard/my-drive"
            colorClassName="text-[var(--sidebar-icon-drive)]"
          />
          <SidebarItem icon={FileText} label="Recent" to="/dashboard/recent" />
          <SidebarItem
            icon={Star}
            label="Starred"
            to="/dashboard/starred"
            colorClassName="text-[var(--sidebar-icon-starred)]"
          />
          <SidebarItem icon={Share} label="Shared" to="/dashboard/shared" />
          <SidebarItem
            icon={Trash2}
            label="Trash"
            to="/dashboard/trash"
            colorClassName="text-[var(--sidebar-icon-trash)]"
          />
          <div className="my-2 border-t border-border" />
          <SidebarItem
            icon={Settings}
            label="Settings"
            to="/dashboard/settings"
          />
        </nav>
      </div>

      {/* Theme Toggle - Placed before storage, always visible in expanded sidebar */}
      <div
        className={cn(
          "p-4 border-t transition-opacity duration-300",
          collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
      >
        <ThemeToggle />
      </div>

      {/* Storage Section - Placed at the bottom */}
      {user &&
        typeof user.storageUsed === "number" &&
        typeof user.storageLimit === "number" && (
          <div
            className={cn(
              "p-4 border-t transition-opacity duration-300", // Use transition-opacity. Removed mt-auto as ThemeToggle is above.
              collapsed ? "opacity-0 pointer-events-none" : "opacity-100", // Control visibility with opacity
            )}
          >
            <h4 className="text-sm font-semibold mb-1">Storage</h4>
            <div className="text-xs text-muted-foreground">
              {formatBytes(user.storageUsed)} of{" "}
              {formatBytes(user.storageLimit)} used
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5 mt-1">
              {/* TODO: Make gradient themeable if desired, for now it's brand colors */}
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
