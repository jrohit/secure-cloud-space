
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
        className="flex items-center cursor-pointer w-full"
        onClick={(e) => {
          // Don't navigate if clicking on the dropdown
          if ((e.target as HTMLElement).closest('.dropdown-menu-trigger')) {
            e.stopPropagation();
            return;
          }
          onClick();
        }}
      >
        <div className="flex items-center flex-1">
          <div className="mr-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50">
              <FolderOpen className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-medium truncate max-w-[350px]" title={folder.name}>
              {folder.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Folder
            </p>
          </div>
        </div>
        
        <div className="flex items-center ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8 rounded-full p-0 ml-2 dropdown-menu-trigger"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Actions</span>
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
        <div className="aspect-square flex items-center justify-center bg-blue-50">
          <FolderOpen className="h-16 w-16 text-blue-500" />
        </div>
      </CardContent>
      <CardFooter className="p-3 flex-col items-start gap-1">
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
                className="h-8 w-8 dropdown-menu-trigger -mt-1 -mr-2"
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
