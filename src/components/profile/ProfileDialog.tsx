
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/services/api";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({ open, onOpenChange }) => {
  const { user, token, updateUser } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  if (!user || !token) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Avatar image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const result = await usersApi.uploadAvatar(token, file);
      updateUser(result.user);
      toast({
        title: "Success",
        description: "Avatar updated successfully",
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast({
        title: "Error",
        description: "Failed to update avatar",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!token) return;
    
    try {
      await usersApi.deleteAvatar(token);
      updateUser({ ...user, avatar: null });
      toast({
        title: "Success",
        description: "Avatar removed successfully",
      });
    } catch (error) {
      console.error("Avatar remove error:", error);
      toast({
        title: "Error",
        description: "Failed to remove avatar",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>
            Update your profile picture and view your account details.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-4 space-y-4">
          <Avatar className="h-24 w-24">
            <AvatarImage src={user.avatar || undefined} alt={user.name} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="avatar">Profile Picture</Label>
            <Input 
              id="avatar" 
              type="file" 
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={isUploading}
            />
            {user.avatar && (
              <Button 
                variant="destructive" 
                onClick={handleRemoveAvatar}
                size="sm"
                className="mt-2"
              >
                Remove Avatar
              </Button>
            )}
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <p>{user.name}</p>
          </div>
          <div>
            <Label>Email</Label>
            <p>{user.email}</p>
          </div>
          <div>
            <Label>Member Since</Label>
            <p>{new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
