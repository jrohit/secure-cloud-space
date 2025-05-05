
import { Button } from "@/components/ui/button";
import { CloudUpload } from "lucide-react";

const FilesEmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <CloudUpload className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">No files yet</h3>
      <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-sm">
        Upload files or create folders to organize your content securely in the cloud.
      </p>
    </div>
  );
};

export default FilesEmptyState;
