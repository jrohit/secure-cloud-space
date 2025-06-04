import { Spinner } from "@/components/ui/Spinner"; // For loading state
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
import { Button } from "@/components/ui/button"; // For placeholder buttons
import { useToast } from "@/components/ui/use-toast"; // For displaying errors or info
import { useAuth } from "@/contexts/AuthContext"; // For getting the token
import { filesApi } from "@/services/api"; // Assuming filesApi is in @/services/api
import { MyFileType } from "@/types"; // Changed from File to MyFileType
import React, { useEffect, useState } from "react";

const TrashPage: React.FC = () => {
  const { token, refreshUserStorageInfo } = useAuth();
  const { toast } = useToast();
  const [trashedFiles, setTrashedFiles] = useState<MyFileType[]>([]);
  const [trashedFolders, setTrashedFolders] = useState<import('@/types').Folder[]>([]); // Added for folders
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] =
    useState(false);
  const [fileToDeletePermanently, setFileToDeletePermanently] =
    useState<MyFileType | null>(null); // Changed from File | null
  const [isConfirmEmptyTrashDialogOpen, setIsConfirmEmptyTrashDialogOpen] =
    useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]); // Added state for selected files
  const [
    isConfirmDeleteSelectedDialogOpen,
    setIsConfirmDeleteSelectedDialogOpen,
  ] = useState(false); // Added state for delete selected confirmation

  useEffect(() => {
    // if (token) { // Actual API call commented out for this subtask
    //   setIsLoading(true);
    //   filesApi
    //     .getTrashedFiles(token)
    //     .then((data) => {
    //       setTrashedFiles(data);
    //     })
    //     .catch((error) => {
    //       console.error("Error fetching trashed files:", error);
    //       toast({
    //         title: "Error",
    //         description: "Failed to fetch trashed files.",
    //         variant: "destructive",
    //       });
    //     })
    //     .finally(() => {
    //       setIsLoading(false);
    //     });
    // }

    // Mocked data fetching for this subtask
    setIsLoading(true);
    setTimeout(() => {
      const mockTrashedFiles: MyFileType[] = [
        { _id: 'file1_trashed', name: 'Trashed Document.pdf', type: 'application/pdf', size: 1024, trashedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(), folderId: null, userId: 'user1', isStarred: false, path: 'dummy', createdAt: new Date().toISOString() },
        { _id: 'file2_trashed', name: 'Old Photo.jpg', type: 'image/jpeg', size: 2048, trashedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(), folderId: null, userId: 'user1', isStarred: false, path: 'dummy', createdAt: new Date().toISOString()  },
      ];
      const mockTrashedFolders: import('@/types').Folder[] = [
        { _id: 'folder1_trashed', name: 'Old Project (Trashed)', trashedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), parentId: null, userId: 'user1', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      ];
      setTrashedFiles(mockTrashedFiles);
      setTrashedFolders(mockTrashedFolders); // Set mocked folders
      setIsLoading(false);
    }, 1000);
  }, [token, toast]); // Still depend on token and toast for consistency, though token not used in mock

  const handleRestoreFile = async (fileId: string) => {
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found. Cannot restore file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const restoredFile = await filesApi.restoreFile(token, fileId);
      setTrashedFiles((prevFiles) =>
        prevFiles.filter((file) => file._id !== fileId)
      );
      toast({
        title: "Success",
        // description: `"${restoredFile.name}" has been restored.`, // Actual API response not used in this version of subtask
        description: `The file has been restored to its original location.`, // Mocked message
      });
    } catch (error) {
      // This catch block might not be hit if filesApi.restoreFile is fully mocked and always succeeds
      console.error("Error restoring file:", error);
      toast({
        title: "Error",
        description: "Failed to restore file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRestoreAll = async () => {
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found.",
        variant: "destructive",
      });
      return;
    }
    if (trashedFiles.length === 0) {
      toast({ title: "Info", description: "Trash is already empty." });
      return;
    }

    toast({
      title: "Restoring All...",
      description: `Attempting to restore all ${trashedFiles.length} file(s).`,
    });

    try {
      const result = await filesApi.restoreAllFromTrash(token);

      toast({
        title: "Restore All Complete",
        description: `${result.restoredCount} file(s) restored. ${
          result.message || ""
        }`,
        variant: "default",
      });

      const updatedTrashedFiles = await filesApi.getTrashedFiles(token);
      setTrashedFiles(updatedTrashedFiles);
      setSelectedFileIds([]);
    } catch (error: any) {
      toast({
        title: "Error Restoring All",
        description:
          error.message ||
          "An unexpected error occurred during Restore All operation.",
        variant: "destructive",
      });
      try {
        const updatedTrashedFiles = await filesApi.getTrashedFiles(token);
        setTrashedFiles(updatedTrashedFiles);
      } catch (refreshError) {
        console.error(
          "Error refreshing trashed files after failed Restore All:",
          refreshError
        );
      }
      setSelectedFileIds([]);
    }
  };

  const handleRestoreFolder = async (folderId: string) => {
    if (!token) { // Though token not used in mock, good to keep check
      toast({
        title: "Error",
        description: "Authentication token not found. Cannot restore folder.",
        variant: "destructive",
      });
      return;
    }

    // Mocked behavior for this subtask
    console.log(`Restoring folder ${folderId}`);
    // const folderToRestore = trashedFolders.find(f => f._id === folderId);
    setTrashedFolders(prevFolders => prevFolders.filter(f => f._id !== folderId));
    toast({
      title: "Folder Restored",
      // description: `Folder "${folderToRestore?.name}" and its contents have been restored.`
      description: "The folder and its contents have been restored." // Generic message as per subtask
    });
    // In a real scenario, this would call foldersApi.restoreFolder(token, folderId)
  };

  const handlePermanentDeleteFileClick = async (file: MyFileType) => {
    if (!token) {
      toast({ title: "Error", description: "Authentication token not found.", variant: "destructive" });
      return;
    }
    if (window.confirm(`Are you sure you want to permanently delete this file: "${file.name}"? This action cannot be undone.`)) {
      console.log(`Permanently deleting file ${file._id}`);
      try {
        await filesApi.deleteFilePermanently(token, file._id);
        setTrashedFiles(prevFiles => prevFiles.filter(f => f._id !== file._id));
        toast({ title: "File Permanently Deleted", description: `"${file.name}" has been permanently deleted.` });
        if (refreshUserStorageInfo) {
          await refreshUserStorageInfo();
        }
      } catch (error) {
        console.error("Error permanently deleting file:", error);
        toast({ title: "Error", description: "Failed to permanently delete file.", variant: "destructive" });
      }
    }
  };

  const handlePermanentDeleteFolderClick = async (folder: import('@/types').Folder) => {
    if (!token) {
      toast({ title: "Error", description: "Authentication token not found.", variant: "destructive" });
      return;
    }
    if (window.confirm(`Are you sure you want to permanently delete this folder: "${folder.name}"? This action cannot be undone and will delete all its contents.`)) {
      console.log(`Permanently deleting folder ${folder._id}`);
      try {
        await foldersApi.permanentlyDeleteTrashedFolder(token, folder._id); // CORRECTED API
        setTrashedFolders(prevFolders => prevFolders.filter(f => f._id !== folder._id));
        toast({ title: "Folder Permanently Deleted", description: `Folder "${folder.name}" and its contents have been permanently deleted.` });
        if (refreshUserStorageInfo) {
          await refreshUserStorageInfo();
        }
      } catch (error) {
        console.error("Error permanently deleting folder:", error);
        toast({ title: "Error", description: "Failed to permanently delete folder.", variant: "destructive" });
      }
    }
  };

  const handleRestoreSelected = async () => {
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found.",
        variant: "destructive",
      });
      return;
    }
    if (selectedFileIds.length === 0) {
      toast({ title: "Info", description: "No files selected to restore." });
      return;
    }

    let restoredCount = 0;
    let errorCount = 0;

    toast({
      title: "Restoring...",
      description: `Attempting to restore ${selectedFileIds.length} file(s).`,
    });

    try {
      for (const fileId of selectedFileIds) {
        try {
          await filesApi.restoreFile(token, fileId);
          restoredCount++;
        } catch (error) {
          console.error(`Error restoring file ${fileId}:`, error);
          errorCount++;
        }
      }

      toast({
        title: "Restore Operation Complete",
        description: `${restoredCount} file(s) restored. ${
          errorCount > 0 ? `${errorCount} failed.` : ""
        }`,
        variant:
          errorCount > 0 && restoredCount > 0
            ? "warning"
            : errorCount > 0
            ? "destructive"
            : "default",
      });

      if (restoredCount > 0) {
        const updatedTrashedFiles = await filesApi.getTrashedFiles(token);
        setTrashedFiles(updatedTrashedFiles);
      }
      setSelectedFileIds([]);
    } catch (apiError) {
      console.error("Error refreshing trashed files after restore:", apiError);
      toast({
        title: "Error",
        description: "Could not refresh trashed files list.",
        variant: "destructive",
      });
      setSelectedFileIds([]);
    }
  };

  const openDeleteSelectedConfirmationDialog = () => {
    if (selectedFileIds.length === 0) {
      toast({
        title: "Info",
        description: "No files selected for permanent deletion.",
      });
      return;
    }
    setIsConfirmDeleteSelectedDialogOpen(true);
  };

  const handleDeleteSelectedPermanently = async () => {
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found.",
        variant: "destructive",
      });
      return;
    }
    if (selectedFileIds.length === 0) return;

    let deletedCount = 0;
    let errorCount = 0;

    toast({
      title: "Deleting...",
      description: `Attempting to permanently delete ${selectedFileIds.length} file(s).`,
    });

    try {
      for (const fileId of selectedFileIds) {
        try {
          await filesApi.deleteFilePermanently(token, fileId);
          deletedCount++;
        } catch (error) {
          console.error(`Error permanently deleting file ${fileId}:`, error);
          errorCount++;
        }
      }

      toast({
        title: "Permanent Deletion Complete",
        description: `${deletedCount} file(s) permanently deleted. ${
          errorCount > 0 ? `${errorCount} failed.` : ""
        }`,
        variant:
          errorCount > 0 && deletedCount > 0
            ? "warning"
            : errorCount > 0
            ? "destructive"
            : "default",
      });

      if (deletedCount > 0) {
        const updatedTrashedFiles = await filesApi.getTrashedFiles(token);
        setTrashedFiles(updatedTrashedFiles);
      }
      setSelectedFileIds([]);
    } catch (apiError) {
      console.error(
        "Error refreshing trashed files after permanent delete:",
        apiError
      );
      toast({
        title: "Error",
        description: "Could not refresh trashed files list.",
        variant: "destructive",
      });
      setSelectedFileIds([]);
    } finally {
      setIsConfirmDeleteSelectedDialogOpen(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found. Cannot empty trash.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await filesApi.emptyTrash(token);
      setTrashedFiles([]); // Clear the local list of trashed files
      toast({
        title: "Success",
        description: `${result.message || "Trash emptied successfully."} ${
          result.count > 0 ? `${result.count} file(s) deleted.` : ""
        }`,
      });
      if (result.count > 0 && refreshUserStorageInfo) {
        await refreshUserStorageInfo();
      }
    } catch (error) {
      console.error("Error emptying trash:", error);
      toast({
        title: "Error",
        description: "Failed to empty trash. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConfirmEmptyTrashDialogOpen(false);
    }
  };

  const openConfirmationDialog = (file: MyFileType) => {
    // Changed from File to MyFileType
    setFileToDeletePermanently(file);
    setIsConfirmDeleteDialogOpen(true);
  };

  const handleCheckboxChange = (fileId: string, isChecked: boolean) => {
    // Added checkbox handler
    setSelectedFileIds((prevSelectedIds) => {
      if (isChecked) {
        return [...prevSelectedIds, fileId];
      } else {
        return prevSelectedIds.filter((id) => id !== fileId);
      }
    });
  };

  const handleDeleteFilePermanently = async () => {
    if (!token || !fileToDeletePermanently) {
      toast({
        title: "Error",
        description:
          "Required information is missing. Cannot permanently delete file.",
        variant: "destructive",
      });
      return;
    }

    const fileIdToDelete = fileToDeletePermanently._id;
    const fileNameToDelete = fileToDeletePermanently.name; // For the toast message

    try {
      await filesApi.deleteFilePermanently(token, fileIdToDelete);
      setTrashedFiles((prevFiles) =>
        prevFiles.filter((file) => file._id !== fileIdToDelete)
      );
      toast({
        title: "Success",
        description: `"${fileNameToDelete}" has been permanently deleted.`,
      });
      if (refreshUserStorageInfo) {
        await refreshUserStorageInfo();
      }
    } catch (error) {
      console.error("Error permanently deleting file:", error);
      toast({
        title: "Error",
        description: "Failed to permanently delete file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConfirmDeleteDialogOpen(false);
      setFileToDeletePermanently(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Trash</h2>
        <div className="flex space-x-2">
          {/* Selective action buttons - simplified for this specific subtask version focusing on individual restore */}
          {/* {selectedFileIds.length > 0 && ( ... )} */}

          {/* Buttons for when no files are selected */}
          {/* For this subtask, these global actions can be simplified or temporarily removed if focusing only on item-level restore */}
          {(trashedFiles.length > 0 || trashedFolders.length > 0) && selectedFileIds.length === 0 && (
            <>
              {/* <Button variant="outline" size="sm" onClick={handleRestoreAll}> Restore All Files </Button> */}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsConfirmEmptyTrashDialogOpen(true)}
              >
                Empty Trash
              </Button>
            </>
          )}
        </div>
      </div>

      {(trashedFiles.length === 0 && trashedFolders.length === 0) ? (
        <p>Your trash is empty.</p>
      ) : (
        <>
          {/* Display Trashed Folders */}
          {trashedFolders.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Folders</h3>
              <ul className="space-y-2">
                {trashedFolders.map((folder) => (
                  <li key={folder._id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                    <div>
                      <p className="font-medium" title={folder.name}>{folder.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Trashed: {folder.trashedAt ? new Date(folder.trashedAt).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                    <div className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleRestoreFolder(folder._id)}>Restore</Button>
                      <Button variant="destructive" size="sm" onClick={() => handlePermanentDeleteFolderClick(folder)}>Delete Permanently</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Display Trashed Files */}
          {trashedFiles.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Files</h3>
              <ul className="space-y-2">
                {trashedFiles.map((file) => (
                  <li key={file._id} className="flex items-center p-2 border rounded space-x-3 hover:bg-muted/50">
                    {/* Checkbox can be re-added if select-all/batch actions are re-enabled for this view */}
                    {/* <input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600" checked={selectedFileIds.includes(file._id)} onChange={(e) => handleCheckboxChange(file._id, e.target.checked)} /> */}
                    <div className="flex-grow flex justify-between items-center">
                      <div>
                        <p className="font-medium" title={file.displayPath || file.name}>
                          {file.displayPath || file.name} ({file.type})
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Trashed: {file.trashedAt ? new Date(file.trashedAt).toLocaleDateString() : "N/A"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Size: {file.size} bytes {/* Adjust formatting as needed */}
                        </p>
                      </div>
                      <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleRestoreFile(file._id)}>Restore</Button>
                        <Button variant="destructive" size="sm" onClick={() => handlePermanentDeleteFileClick(file)}>Delete Permanently</Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Confirmation dialogs are kept but might not be triggered by current simplified UI for this subtask */}
      <AlertDialog
        open={isConfirmDeleteDialogOpen}
        onOpenChange={setIsConfirmDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              file "{fileToDeletePermanently?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToDeletePermanently(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFilePermanently}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Trash Confirmation Dialog */}
      <AlertDialog
        open={isConfirmEmptyTrashDialogOpen}
        onOpenChange={setIsConfirmEmptyTrashDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you absolutely sure you want to empty the trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All files currently in the trash
              will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmptyTrash}>
              Empty Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Selected Confirmation Dialog */}
      <AlertDialog
        open={isConfirmDeleteSelectedDialogOpen}
        onOpenChange={setIsConfirmDeleteSelectedDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              selected {selectedFileIds.length} file(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelectedPermanently}>
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrashPage;
