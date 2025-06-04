import { Spinner } from "@/components/ui/Spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { filesApi, foldersApi } from "@/services/api";
import { MyFileType, Folder } from "@/types"; // Ensure Folder is imported
import React, { useEffect, useState, useCallback } from "react";

const TrashPage: React.FC = () => {
  const { token, refreshUserStorageInfo } = useAuth();
  const { toast } = useToast();
  const [trashedFiles, setTrashedFiles] = useState<MyFileType[]>([]);
  const [trashedFolders, setTrashedFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [isConfirmFileDeleteOpen, setIsConfirmFileDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MyFileType | Folder | null>(null); // Generic for item to delete
  const [deleteType, setDeleteType] = useState<"file" | "folder" | null>(null);


  const [isConfirmEmptyFileTrashOpen, setIsConfirmEmptyFileTrashOpen] = useState(false);
  const [isConfirmEmptyFolderTrashOpen, setIsConfirmEmptyFolderTrashOpen] = useState(false);


  const fetchTrashedItems = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const filesData = await filesApi.getTrashedFiles(token);
      const foldersData = await foldersApi.getTrashedFolders(token);
      setTrashedFiles(filesData);
      setTrashedFolders(foldersData);
    } catch (error) {
      console.error("[TrashPage] Error fetching trashed items:", error);
      toast({
        title: "Error",
        description: "Failed to load trashed items.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    fetchTrashedItems();
  }, [fetchTrashedItems]);

  // File Action Handlers
  const handleRestoreFile = async (fileId: string) => {
    if (!token) return;
    // Optimistic update
    const originalFiles = trashedFiles;
    setTrashedFiles((prev) => prev.filter((f) => f._id !== fileId));
    try {
      await filesApi.restoreFile(token, fileId);
      toast({ title: "Success", description: "File restored successfully." });
      // No need to re-fetch, optimistic update is enough
    } catch (error) {
      setTrashedFiles(originalFiles); // Revert on error
      toast({ title: "Error", description: "Failed to restore file.", variant: "destructive" });
    }
  };

  const openPermanentDeleteFileDialog = (file: MyFileType) => {
    setItemToDelete(file);
    setDeleteType("file");
    setIsConfirmFileDeleteOpen(true);
  };

  const handlePermanentDeleteFile = async () => {
    if (!token || !itemToDelete || deleteType !== 'file') return;
    const file = itemToDelete as MyFileType;
    // Optimistic update
    const originalFiles = trashedFiles;
    setTrashedFiles((prev) => prev.filter((f) => f._id !== file._id));
    setIsConfirmFileDeleteOpen(false);

    try {
      await filesApi.deleteFilePermanently(token, file._id);
      toast({ title: "Success", description: `File "${file.name}" permanently deleted.` });
      await refreshUserStorageInfo();
    } catch (error) {
      setTrashedFiles(originalFiles); // Revert
      toast({ title: "Error", description: "Failed to permanently delete file.", variant: "destructive" });
    } finally {
      setItemToDelete(null);
      setDeleteType(null);
    }
  };

  const handleEmptyFileTrash = async () => {
    if (!token) return;
    setIsLoading(true); // Indicate loading for emptying trash
    try {
      const result = await filesApi.emptyTrash(token);
      setTrashedFiles([]);
      toast({ title: "Success", description: result.message || "File trash emptied successfully." });
      await refreshUserStorageInfo();
    } catch (error) {
      toast({ title: "Error", description: "Failed to empty file trash.", variant: "destructive" });
      await fetchTrashedItems(); // Refetch on error to get current state
    } finally {
      setIsConfirmEmptyFileTrashOpen(false);
      setIsLoading(false);
    }
  };

  // Folder Action Handlers
  const handleRestoreFolder = async (folderId: string) => {
    if (!token) return;
    // Optimistic update
    const originalFolders = trashedFolders;
    setTrashedFolders((prev) => prev.filter((f) => f._id !== folderId));
    try {
      await foldersApi.restoreFolder(token, folderId);
      toast({ title: "Success", description: "Folder restored successfully." });
      // No need to re-fetch, optimistic update is enough
    } catch (error) {
      setTrashedFolders(originalFolders); // Revert
      toast({ title: "Error", description: "Failed to restore folder.", variant: "destructive" });
    }
  };

  const openPermanentDeleteFolderDialog = (folder: Folder) => {
    setItemToDelete(folder);
    setDeleteType("folder");
    setIsConfirmFileDeleteOpen(true); // Re-use the same dialog state but with different item and type
  };

  const handlePermanentDeleteFolder = async () => {
    if (!token || !itemToDelete || deleteType !== 'folder') return;
    const folder = itemToDelete as Folder;
    // Optimistic update
    const originalFolders = trashedFolders;
    setTrashedFolders((prev) => prev.filter((f) => f._id !== folder._id));
    setIsConfirmFileDeleteOpen(false);

    try {
      await foldersApi.permanentlyDeleteTrashedFolder(token, folder._id);
      toast({ title: "Success", description: `Folder "${folder.name}" permanently deleted.` });
      await refreshUserStorageInfo();
    } catch (error) {
      setTrashedFolders(originalFolders); // Revert
      toast({ title: "Error", description: "Failed to permanently delete folder.", variant: "destructive" });
    } finally {
      setItemToDelete(null);
      setDeleteType(null);
    }
  };

  const handleEmptyFolderTrash = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await foldersApi.emptyTrash(token);
      setTrashedFolders([]);
      toast({ title: "Success", description: result.message || "Folder trash emptied successfully." });
      await refreshUserStorageInfo();
    } catch (error) {
      toast({ title: "Error", description: "Failed to empty folder trash.", variant: "destructive" });
      await fetchTrashedItems(); // Refetch on error
    } finally {
      setIsConfirmEmptyFolderTrashOpen(false);
      setIsLoading(false);
    }
  };


  if (isLoading && (trashedFiles.length === 0 && trashedFolders.length === 0)) { // Show initial loading spinner
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Trash</h2>
        {/* Add overall actions if needed, or keep them specific */}
      </div>

      {/* Folders Section */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-semibold">Trashed Folders</h3>
          {trashedFolders.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsConfirmEmptyFolderTrashOpen(true)}
              disabled={isLoading}
            >
              {isLoading ? <Spinner size="sm" /> : "Empty Folder Trash"}
            </Button>
          )}
        </div>
        {isLoading && trashedFolders.length === 0 ? <Spinner /> : trashedFolders.length === 0 ? (
          <p>No folders in trash.</p>
        ) : (
          <ul className="space-y-2">
            {trashedFolders.map((folder) => (
              <li key={folder._id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                <div>
                  <p className="font-medium" title={folder.name}>{folder.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Trashed: {folder.trashedAt ? new Date(folder.trashedAt).toLocaleDateString() : "N/A"}
                  </p>
                </div>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleRestoreFolder(folder._id)} disabled={isLoading}>Restore</Button>
                  <Button variant="destructive" size="sm" onClick={() => openPermanentDeleteFolderDialog(folder)} disabled={isLoading}>Delete Permanently</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Files Section */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-semibold">Trashed Files</h3>
          {trashedFiles.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsConfirmEmptyFileTrashOpen(true)}
              disabled={isLoading}
            >
              {isLoading ? <Spinner size="sm" /> : "Empty File Trash"}
            </Button>
          )}
        </div>
        {isLoading && trashedFiles.length === 0 ? <Spinner /> : trashedFiles.length === 0 ? (
          <p>No files in trash.</p>
        ) : (
          <ul className="space-y-2">
            {trashedFiles.map((file) => (
              <li key={file._id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                <div>
                  <p className="font-medium" title={file.displayPath || file.name}>
                    {file.displayPath || file.name} ({file.type})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Size: {file.size} bytes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Trashed: {file.trashedAt ? new Date(file.trashedAt).toLocaleDateString() : "N/A"}
                  </p>
                </div>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleRestoreFile(file._id)} disabled={isLoading}>Restore</Button>
                  <Button variant="destructive" size="sm" onClick={() => openPermanentDeleteFileDialog(file)} disabled={isLoading}>Delete Permanently</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(trashedFiles.length === 0 && trashedFolders.length === 0 && !isLoading) && (
         <p className="text-center text-muted-foreground mt-8">Your trash is completely empty.</p>
      )}

      {/* Confirmation Dialog for Single Item Permanent Delete (File or Folder) */}
      <AlertDialog
        open={isConfirmFileDeleteOpen} // Reused for both file and folder
        onOpenChange={setIsConfirmFileDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete
              "{itemToDelete?.name}". {deleteType === 'folder' && "All its contents will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsConfirmFileDeleteOpen(false); setItemToDelete(null); setDeleteType(null); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={deleteType === 'file' ? handlePermanentDeleteFile : handlePermanentDeleteFolder}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty File Trash Confirmation Dialog */}
      <AlertDialog
        open={isConfirmEmptyFileTrashOpen}
        onOpenChange={setIsConfirmEmptyFileTrashOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty File Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              All files in the trash will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmptyFileTrash}>Empty File Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Folder Trash Confirmation Dialog */}
      <AlertDialog
        open={isConfirmEmptyFolderTrashOpen}
        onOpenChange={setIsConfirmEmptyFolderTrashOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Folder Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              All folders and their contents in the trash will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmptyFolderTrash}>Empty Folder Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrashPage;
