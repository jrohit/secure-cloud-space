import * as React from 'react';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Trash2, Pencil, FolderCog } from 'lucide-react';

interface ItemContextMenuProps {
  itemType: 'file' | 'folder';
  itemId: string;
  itemName: string;
  currentParentId: string | null; // Added
  onDelete: (id: string, type: 'file' | 'folder') => void;
  onRename: (id: string, type: 'file' | 'folder', currentName: string) => void;
  onOrganize: (id: string, type: 'file' | 'folder', currentParentId: string | null) => void; // Modified
}

const ItemContextMenu: React.FC<ItemContextMenuProps> = ({
  itemType,
  itemId,
  itemName,
  currentParentId, // Added
  onDelete,
  onRename,
  onOrganize, // Modified
}) => {
  return (
    <ContextMenuContent>
      <ContextMenuItem onClick={() => onRename(itemId, itemType, itemName)}>
        <Pencil className="mr-2 h-4 w-4" />
        <span>Rename</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onOrganize(itemId, itemType, currentParentId)}>
        <FolderCog className="mr-2 h-4 w-4" />
        <span>Organize</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => onDelete(itemId, itemType)}
        className="text-destructive focus:text-destructive focus:bg-destructive/10"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        <span>Delete</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );
};

export default ItemContextMenu;
