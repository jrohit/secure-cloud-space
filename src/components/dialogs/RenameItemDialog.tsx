import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

interface RenameItemDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  itemType: 'file' | 'folder';
  itemId: string; // Though not directly used in this component's logic, good for context
  currentName: string;
  onRenameSubmit: (newName: string) => Promise<void>;
}

const RenameItemDialog: React.FC<RenameItemDialogProps> = ({
  isOpen,
  onOpenChange,
  itemType,
  currentName,
  onRenameSubmit,
}) => {
  const [newName, setNewName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    if (newName.trim() === currentName) {
      onOpenChange(false); // Close dialog if name hasn't changed
      return;
    }

    setIsLoading(true);
    try {
      await onRenameSubmit(newName.trim());
      // onOpenChange(false); // Dialog will be closed by parent component's logic after successful submit
    } catch (error) {
      // Error toast is expected to be handled by the parent component (Dashboard)
      // or the onRenameSubmit implementation itself.
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename {itemType}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                New Name
              </Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading || !newName.trim()}>
              {isLoading ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RenameItemDialog;
