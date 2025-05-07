
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderItemProps } from "@/types";
import { Folder, MoreVertical, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { userEncryptionService } from "@/services/api/userEncryption";

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  onClick,
  onDelete,
  viewMode = "grid",
}) => {
  const { masterKey } = useAuth();
  const [decryptedName, setDecryptedName] = useState<string>(folder.name);

  useEffect(() => {
    if (masterKey && folder.metadataEncrypted) {
      const decrypted = userEncryptionService.decryptName(folder.name, masterKey);
      setDecryptedName(decrypted || folder.name);
    } else {
      setDecryptedName(folder.name);
    }
  }, [folder.name, masterKey, folder.metadataEncrypted]);

  const handleClick = () => {
    onClick();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  if (viewMode === "grid") {
    return (
      <div
        className="group relative flex flex-col rounded-lg border bg-card p-2 transition-all hover:shadow-md"
        onClick={handleClick}
      >
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="aspect-square mb-2 overflow-hidden rounded-lg">
          <div className="flex h-full items-center justify-center bg-muted">
            <Folder className="h-16 w-16 text-blue-500" />
          </div>
        </div>

        <div className="flex items-start justify-between space-x-2 text-sm">
          <div className="truncate font-medium">{decryptedName}</div>
        </div>
      </div>
    );
  } else {
    // List view
    return (
      <div
        className="group flex items-center justify-between rounded-lg border bg-card p-2 transition-all hover:bg-accent"
        onClick={handleClick}
      >
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
            <Folder className="h-6 w-6 text-blue-500" />
          </div>
          <div className="font-medium">{decryptedName}</div>
        </div>

        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }
};

export default FolderItem;
