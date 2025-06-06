import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Folder as FolderType } from "@/types";
import { useToast } from "@/components/ui/use-toast";

interface OrganizeItemDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  itemType: "file" | "folder";
  itemName: string;
  // currentParentId: string | null; // Not directly used for selection logic here, but good for context
  availableFolders: FolderType[]; // Filtered list of folders
  onOrganizeSubmit: (newParentId: string | null) => Promise<void>;
}

const OrganizeItemDialog: React.FC<OrganizeItemDialogProps> = ({
  isOpen,
  onOpenChange,
  itemType,
  itemName,
  availableFolders,
  onOrganizeSubmit,
}) => {
  const [selectedParentId, setSelectedParentId] = React.useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();

  // Reset selection when dialog opens/closes or item changes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedParentId("__SELECT_DESTINATION__"); // Special value for placeholder
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (selectedParentId === "__SELECT_DESTINATION__") {
      toast({
        title: "Validation Error",
        description:
          "Please select a destination folder or choose to move to My Drive.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // If "__ROOT__" is selected, newParentId is null, otherwise it's the selected folder's ID
      await onOrganizeSubmit(
        selectedParentId === "__ROOT__" ? null : selectedParentId,
      );
    } catch (error) {
      // Error toast is expected to be handled by the parent component (Dashboard)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Organize {itemType}: {itemName}
          </DialogTitle>
          <DialogDescription>
            Select a new location for your {itemType}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            onClick={() => setSelectedParentId("__ROOT__")}
            className={
              selectedParentId === "__ROOT__" ? "ring-2 ring-primary" : ""
            }
          >
            Move to My Drive (root)
          </Button>

          <div className="flex items-center gap-2">
            <hr className="flex-grow" />
            <span>OR</span>
            <hr className="flex-grow" />
          </div>

          <Select
            onValueChange={(value) => setSelectedParentId(value)}
            value={
              selectedParentId !== null && selectedParentId !== "__ROOT__"
                ? selectedParentId
                : undefined
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a folder..." />
            </SelectTrigger>
            <SelectContent>
              {availableFolders.length === 0 ? (
                <SelectItem value="no-folders" disabled>
                  No other folders available
                </SelectItem>
              ) : (
                availableFolders.map((folder) => (
                  <SelectItem key={folder._id} value={folder._id}>
                    {folder.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              isLoading || selectedParentId === "__SELECT_DESTINATION__"
            }
          >
            {isLoading ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrganizeItemDialog;
