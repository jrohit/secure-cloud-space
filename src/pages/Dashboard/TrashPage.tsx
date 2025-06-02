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
import { File } from "@/types"; // Assuming File type is defined in @/types
import React, { useEffect, useState } from "react";

const TrashPage: React.FC = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [trashedFiles, setTrashedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] =
    useState(false);
  const [fileToDeletePermanently, setFileToDeletePermanently] =
    useState<File | null>(null);
  const [isConfirmEmptyTrashDialogOpen, setIsConfirmEmptyTrashDialogOpen] =
    useState(false);

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

  const openConfirmationDialog = (file: File) => {
    setFileToDeletePermanently(file);
    setIsConfirmDeleteDialogOpen(true);
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
        {trashedFiles.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsConfirmEmptyTrashDialogOpen(true)}
          >
            Empty Trash
          </Button>
        )}
      </div>

      {trashedFiles.length === 0 ? (
        <p>Your trash is empty.</p>
      ) : (
        <ul className="space-y-2">
          {trashedFiles.map((file) => (
            <li
              key={file._id}
              className="flex justify-between items-center p-2 border rounded"
            >
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  Trashed:{" "}
                  {file.trashedAt
                    ? new Date(file.trashedAt).toLocaleDateString()
                    : "N/A"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Size: {file.size} bytes
                </p>{" "}
                {/* Adjust formatting as needed */}
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
    </div>
  );
};

export default TrashPage;
