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
  const { token } = useAuth();
  const { toast } = useToast();
  const [trashedFiles, setTrashedFiles] = useState<MyFileType[]>([]); // Changed from File[]
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
    if (token) {
      setIsLoading(true);
      filesApi
        .getTrashedFiles(token)
        .then((data) => {
          setTrashedFiles(data);
        })
        .catch((error) => {
          console.error("Error fetching trashed files:", error);
          toast({
            title: "Error",
            description: "Failed to fetch trashed files.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [token, toast]);

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
        description: `"${restoredFile.name}" has been restored.`,
      });
    } catch (error) {
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
      toast({ title: "Error", description: "Authentication token not found.", variant: "destructive" });
      return;
    }
    if (trashedFiles.length === 0) {
      toast({ title: "Info", description: "Trash is already empty." });
      return;
    }

    toast({ title: "Restoring All...", description: `Attempting to restore all ${trashedFiles.length} file(s).` });

    try {
      const result = await filesApi.restoreAllFromTrash(token);
      
      toast({
          title: "Restore All Complete",
          description: `${result.restoredCount} file(s) restored. ${result.message || ''}`,
          variant: "default"
      });

      const updatedTrashedFiles = await filesApi.getTrashedFiles(token);
      setTrashedFiles(updatedTrashedFiles);
      setSelectedFileIds([]);

    } catch (error: any) {
      toast({
          title: "Error Restoring All",
          description: error.message || "An unexpected error occurred during Restore All operation.",
          variant: "destructive"
      });
      try {
          const updatedTrashedFiles = await filesApi.getTrashedFiles(token);
          setTrashedFiles(updatedTrashedFiles);
      } catch (refreshError) {
          console.error("Error refreshing trashed files after failed Restore All:", refreshError);
      }
      setSelectedFileIds([]);
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

  const openConfirmationDialog = (file: MyFileType) => { // Changed from File to MyFileType
    setFileToDeletePermanently(file);
    setIsConfirmDeleteDialogOpen(true);
  };

  const handleCheckboxChange = (fileId: string, isChecked: boolean) => { // Added checkbox handler
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
            {/* Conditional rendering for selective action buttons */}
            {selectedFileIds.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={handleRestoreSelected}>
                  Restore Selected ({selectedFileIds.length})
                </Button>
                <Button variant="destructive" size="sm" onClick={openDeleteSelectedConfirmationDialog}>
                  Delete Selected Permanently ({selectedFileIds.length})
                </Button>
              </>
            )}

            {/* Buttons for when no files are selected */}
            {selectedFileIds.length === 0 && trashedFiles.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={handleRestoreAll}>
                  Restore All
                </Button>
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

      {trashedFiles.length === 0 ? (
        <p>Your trash is empty.</p>
      ) : (
        <ul className="space-y-2 mt-4"> {/* Added mt-4 for spacing after buttons */}
          {trashedFiles.map((file) => (
            <li
              key={file._id}
              className="flex items-center p-2 border rounded space-x-3" // Added space-x-3
            >
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-blue-600" // Basic styling
                checked={selectedFileIds.includes(file._id)}
                onChange={(e) =>
                  handleCheckboxChange(file._id, e.target.checked)
                }
              />
              <div className="flex-grow flex justify-between items-center">
                <div>
                  <p className="font-medium" title={file.displayPath || file.name}>
                    {file.displayPath || file.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Trashed:{" "}
                    {file.trashedAt
                      ? new Date(file.trashedAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Size: {file.size} bytes {/* Adjust formatting as needed */}
                  </p>
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreFile(file._id)}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openConfirmationDialog(file)}
                  >
                    Delete Permanently
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

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
