
import { Folder, FolderItemProps } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { FolderOpen, Trash2, MoreVertical } from "lucide-react";

const FolderItem: React.FC<FolderItemProps> = ({ folder, onClick, onDelete, viewMode = 'grid' }) => {
  if (viewMode === 'list') {
    return (
      <div 
        className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer"
        onClick={(e) => {
          // Don't navigate if clicking on the dropdown
          if ((e.target as HTMLElement).closest('.dropdown-menu-trigger')) {
            e.stopPropagation();
            return;
          }
          onClick();
        }}
      >
        <div className="flex items-center space-x-3">
          <FolderOpen className="h-5 w-5 text-cloudDrive-blue opacity-80" />
          <span className="font-medium truncate max-w-[150px]" title={folder.name}>
            {folder.name}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(folder.updatedAt), { addSuffix: true })}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 dropdown-menu-trigger"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <Card 
      className="overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer"
      onClick={(e) => {
        // Don't navigate if clicking on the dropdown
        if ((e.target as HTMLElement).closest('.dropdown-menu-trigger')) {
          e.stopPropagation();
          return;
        }
        onClick();
      }}
    >
      <CardContent className="p-0">
        <div className="aspect-square flex items-center justify-center bg-muted/20">
          <FolderOpen className="h-16 w-16 text-cloudDrive-blue opacity-80" />
        </div>
      </CardContent>
      <CardFooter className="p-2 flex-col items-start gap-1">
        <div className="w-full flex justify-between items-start">
          <div className="truncate flex-1">
            <h3 className="text-sm font-medium truncate" title={folder.name}>
              {folder.name}
            </h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 dropdown-menu-trigger"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-xs text-muted-foreground">
          Modified {formatDistanceToNow(new Date(folder.updatedAt), { addSuffix: true })}
        </p>
      </CardFooter>
    </Card>
  );
};

export default FolderItem;
