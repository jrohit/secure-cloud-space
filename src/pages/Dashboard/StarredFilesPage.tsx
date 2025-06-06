import React, { useEffect, useState } from "react";
import { File } from "@/types"; // Assuming File type is defined here
import { useAuth } from "@/contexts/AuthContext";
import { filesApi } from "@/services/api";
import FileGrid from "@/components/files/FileGrid"; // Re-use FileGrid for display
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/Spinner";
import FilesEmptyState from "@/components/files/FilesEmptyState"; // For when no starred files

const StarredFilesPage: React.FC = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [starredFiles, setStarredFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchStarredFiles();
    }
  }, [token]);

  const fetchStarredFiles = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const files = await filesApi.getStarredFiles(token);
      setStarredFiles(files);
    } catch (error) {
      console.error("Error fetching starred files:", error);
      toast({
        title: "Error",
        description: "Failed to load starred files.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler for when a star is toggled on this page
  // This will remove the file from this list if it's unstarred.
  const handleFileStarToggled = (fileId: string, newIsStarred: boolean) => {
    if (!newIsStarred) {
      // If file was unstarred
      setStarredFiles((prevFiles) => prevFiles.filter((f) => f.id !== fileId));
    } else {
      // If it was starred (shouldn't happen from this page if only showing starred files,
      // but good for consistency if FileGrid is reused elsewhere) - we might need to refetch or add it.
      // For simplicity, if a file is starred *again* (e.g. a bug or odd UI flow), refetching is safest.
      fetchStarredFiles();
    }
  };

  // Placeholder for other actions like delete, preview from this page
  // These would require passing more handlers to FileGrid or handling them here
  const handleFileAction = (action: string, fileId: string) => {
    console.log(`Action: ${action} on file: ${fileId} from StarredFilesPage`);
    // Potentially refetch or update list after action
    // e.g. if a file is deleted, it should be removed from starredFiles state
    // For now, a delete would make it disappear on next load.
    // A more robust solution would be to handle delete here too.
    toast({
      title: "Action",
      description: `${action} on ${fileId} (placeholder)`,
    });
    if (action === "delete") {
      setStarredFiles((prevFiles) => prevFiles.filter((f) => f.id !== fileId));
      // Note: This only updates client state. Actual delete API call is not made here yet.
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full py-12">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Starred Files</h2>
      {starredFiles.length === 0 ? (
        <FilesEmptyState message="You have no starred files." />
      ) : (
        <FileGrid
          files={starredFiles}
          folders={[]} // Starred view typically doesn't show folders
          onStarToggle={handleFileStarToggled}
          // Pass other necessary handlers if FileGrid's FileItems need them
          // For example, preview or download. For now, let's assume they are handled
          // by FileItem itself if it doesn't rely on callbacks for those.
          // Or, pass basic handlers:
          onFilePreview={(file) => {
            // Basic preview logic placeholder or integrate with a global preview context/dialog
            console.log("Previewing file from starred:", file.name);
            // This would ideally trigger the same preview dialog as in Dashboard.tsx
            // This might require lifting preview state or creating a reusable preview service/hook.
            // For this step, we'll focus on listing.
            toast({
              title: "Preview",
              description: `Previewing ${file.name} (placeholder)`,
            });
          }}
          onFileDelete={(fileId) => handleFileAction("delete", fileId)}
          // Add other handlers as needed by FileGrid/FileItem for full functionality
        />
      )}
    </div>
  );
};

export default StarredFilesPage;
