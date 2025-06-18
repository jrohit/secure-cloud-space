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
import { useDataRefresh } from "@/contexts/DataRefreshContext"; // Import useDataRefresh
import { filesApi, foldersApi } from "@/services/api";
import { MyFileType, Folder } from "@/types"; // Folder is imported from types
import React, { useEffect, useState, useCallback } from "react";

const TrashPage: React.FC = () => {
  const { token } = useAuth(); // Removed refreshUserStorageInfo from here
  const { requestDataRefresh } = useDataRefresh(); // Use the context hook
  const { toast } = useToast();
  const [trashedFiles, setTrashedFiles] = useState<MyFileType[]>([]);
  const [trashedFolders, setTrashedFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [isConfirmItemDeleteOpen, setIsConfirmItemDeleteOpen] = useState(false); // Single dialog for both file/folder
  const [itemToDelete, setItemToDelete] = useState<MyFileType | Folder | null>(
    null,
  );
  const [deleteType, setDeleteType] = useState<"file" | "folder" | null>(null);

  const [isConfirmEmptyFileTrashOpen, setIsConfirmEmptyFileTrashOpen] =
    useState(false);
  const [isConfirmEmptyFolderTrashOpen, setIsConfirmEmptyFolderTrashOpen] =
    useState(false);

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
    const originalFiles = trashedFiles;
    setTrashedFiles((prev) => prev.filter((f) => f._id !== fileId)); // Optimistic update
    try {
      const response = await filesApi.restoreFile(token, fileId); // Updated to use response
      let description = response.message || "File restored successfully.";
      if (response.restoredToRoot) {
        description +=
          " It was moved to the root folder as its original folder was not accessible.";
      }
      toast({ title: "Success", description: description });
      // Potentially refetch or update parent folder's file list if navigating there next
      // For now, optimistic removal from trash list is primary.
    } catch (error) {
      setTrashedFiles(originalFiles); // Revert on error
      toast({
        title: "Error",
        description: "Failed to restore file.",
        variant: "destructive",
      });
    }
  };

  const openPermanentDeleteItemDialog = (
    item: MyFileType | Folder,
    type: "file" | "folder",
  ) => {
    setItemToDelete(item);
    setDeleteType(type);
    setIsConfirmItemDeleteOpen(true);
  };

  const handlePermanentDeleteItem = async () => {
    if (!token || !itemToDelete || !deleteType) return;

    setIsConfirmItemDeleteOpen(false); // Close dialog immediately

    if (deleteType === "file") {
      const file = itemToDelete as MyFileType;
      const originalFiles = trashedFiles;
      setTrashedFiles((prev) => prev.filter((f) => f._id !== file._id)); // Optimistic
      try {
        await filesApi.deleteFilePermanently(token, file._id);
        toast({
          title: "Success",
          description: `File "${file.name}" permanently deleted.`,
        });
        requestDataRefresh(); // Call context refresh
      } catch (error) {
        setTrashedFiles(originalFiles); // Revert
        toast({
          title: "Error",
          description: "Failed to permanently delete file.",
          variant: "destructive",
        });
      }
    } else if (deleteType === "folder") {
      const folder = itemToDelete as Folder;
      const originalFolders = trashedFolders;
      setTrashedFolders((prev) => prev.filter((f) => f._id !== folder._id)); // Optimistic
      try {
        await foldersApi.permanentlyDeleteTrashedFolder(token, folder._id);
        toast({
          title: "Success",
          description: `Folder "${folder.name}" and its contents permanently deleted.`,
        });
        requestDataRefresh(); // Call context refresh
      } catch (error) {
        setTrashedFolders(originalFolders); // Revert
        toast({
          title: "Error",
          description: "Failed to permanently delete folder.",
          variant: "destructive",
        });
      }
    }
    setItemToDelete(null);
    setDeleteType(null);
  };

  const handleEmptyFileTrash = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await filesApi.emptyTrash(token);
      setTrashedFiles([]);
      toast({
        title: "Success",
        description: result.message || "File trash emptied successfully.",
      });
      requestDataRefresh(); // Call context refresh
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to empty file trash.",
        variant: "destructive",
      });
      await fetchTrashedItems();
    } finally {
      setIsConfirmEmptyFileTrashOpen(false);
      setIsLoading(false);
    }
  };

  // Folder Action Handlers
  const handleRestoreFolder = async (folderId: string) => {
    if (!token) return;
    const originalFolders = trashedFolders;
    setTrashedFolders((prev) => prev.filter((f) => f._id !== folderId)); // Optimistic update
    try {
      const response = await foldersApi.restoreFolder(token, folderId); // Updated to use response
      let description =
        response.message || "Folder and its contents restored successfully.";
      if (response.restoredToRoot) {
        description +=
          " It was moved to the root folder as its original parent folder was not accessible.";
      }
      toast({ title: "Success", description: description });
      // Potentially refetch or update parent folder's list if navigating there next
    } catch (error) {
      setTrashedFolders(originalFolders); // Revert
      toast({
        title: "Error",
        description: "Failed to restore folder.",
        variant: "destructive",
      });
    }
  };

  const handleEmptyFolderTrash = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await foldersApi.emptyTrash(token);
      setTrashedFolders([]);
      toast({
        title: "Success",
        description: result.message || "Folder trash emptied successfully.",
      });
      requestDataRefresh(); // Call context refresh
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to empty folder trash.",
        variant: "destructive",
      });
      await fetchTrashedItems();
    } finally {
      setIsConfirmEmptyFolderTrashOpen(false);
      setIsLoading(false);
    }
  };

  if (isLoading && trashedFiles.length === 0 && trashedFolders.length === 0) {
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
        {isLoading &&
        trashedFolders.length === 0 &&
        !isLoading &&
        trashedFiles.length > 0 ? null : isLoading &&
          trashedFolders.length === 0 ? (
          <Spinner />
        ) : trashedFolders.length === 0 ? (
          <p>No folders in trash.</p>
        ) : (
          <ul className="space-y-2">
            {trashedFolders.map((folder) => (
              <li
                key={folder._id}
                className="flex items-center justify-between p-3 border rounded hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium" title={folder.name}>
                    {folder.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Trashed:{" "}
                    {folder.trashedAt
                      ? new Date(folder.trashedAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreFolder(folder._id)}
                    disabled={isLoading}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      openPermanentDeleteItemDialog(folder, "folder")
                    }
                    disabled={isLoading}
                  >
                    Delete Permanently
                  </Button>
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
        {isLoading &&
        trashedFiles.length === 0 &&
        !isLoading &&
        trashedFolders.length > 0 ? null : isLoading &&
          trashedFiles.length === 0 ? (
          <Spinner />
        ) : trashedFiles.length === 0 ? (
          <p>No files in trash.</p>
        ) : (
          <ul className="space-y-2">
            {trashedFiles.map((file) => (
              <li
                key={file._id}
                className="flex items-center justify-between p-3 border rounded hover:bg-muted/50"
              >
                <div>
                  <p
                    className="font-medium"
                    title={file.displayPath || file.name}
                  >
                    {file.displayPath || file.name} ({file.type})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Size: {file.size} bytes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Trashed:{" "}
                    {file.trashedAt
                      ? new Date(file.trashedAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreFile(file._id)}
                    disabled={isLoading}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openPermanentDeleteItemDialog(file, "file")}
                    disabled={isLoading}
                  >
                    Delete Permanently
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {trashedFiles.length === 0 &&
        trashedFolders.length === 0 &&
        !isLoading && (
          <p className="text-center text-muted-foreground mt-8">
            Your trash is completely empty.
          </p>
        )}

      {/* Confirmation Dialog for Single Item Permanent Delete */}
      <AlertDialog
        open={isConfirmItemDeleteOpen}
        onOpenChange={setIsConfirmItemDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete "
              {itemToDelete?.name}".{" "}
              {deleteType === "folder" &&
                "All its contents will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsConfirmItemDeleteOpen(false);
                setItemToDelete(null);
                setDeleteType(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDeleteItem}>
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
              All files in the trash will be permanently deleted. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmptyFileTrash}>
              Empty File Trash
            </AlertDialogAction>
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
              All folders and their contents in the trash will be permanently
              deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmptyFolderTrash}>
              Empty Folder Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrashPage;
