import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  // DialogDescription, // Available if needed
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
// Input from "@/components/ui/input" is not strictly needed for the styled file input
import { useAuth } from '../../contexts/AuthContext'; // Adjusted path for dialogs folder

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose }) => {
  const { user, updateUserAvatar } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(user?.avatarUrl || '/placeholder.svg');
    }
  }, [user, selectedFile, isOpen]); // Added isOpen to reset preview when dialog reopens

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      if (updateUserAvatar) {
        updateUserAvatar(newPreviewUrl); // Update context for live preview in Navbar, etc.
      }
    } else {
      setSelectedFile(null);
      setPreviewUrl(user?.avatarUrl || '/placeholder.svg');
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset selected file when dialog is closed externally
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      // The previewUrl will be reset by the other useEffect that depends on [user, selectedFile, isOpen]
    }
  }, [isOpen]);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]"> {/* Example width, adjust as needed */}
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
          {/* <DialogDescription>
            View or update your profile information.
          </DialogDescription> */}
        </DialogHeader>

        <div style={{ paddingTop: '1rem', paddingBottom: '1rem' }}> {/* Added some padding */}
          {user && (
            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
              <h3 style={{ marginTop: '0', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px', fontSize: '1.1em' }}>Account Details</h3>
              <p style={{ margin: '4px 0' }}><strong>Name:</strong> {user.name || 'N/A'}</p>
              <p style={{ margin: '4px 0' }}><strong>Email:</strong> {user.email || 'N/A'}</p>
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <img
              src={previewUrl || '/placeholder.svg'}
              alt="Avatar Preview"
              style={{
                width: '120px', // Slightly smaller for dialog
                height: '120px',
                borderRadius: '50%',
                border: '2px solid #ccc',
                objectFit: 'cover',
                display: 'block',
                margin: '0 auto 15px auto'
              }}
            />
            <label htmlFor="avatarInputDialog" style={{ display: 'inline-block', padding: '8px 12px', cursor: 'pointer', color: 'white', backgroundColor: '#007bff', borderRadius: '5px', fontSize: '0.9em' }}>
              Change Avatar
            </label>
            <input
              type="file"
              id="avatarInputDialog" // Changed id to be unique if ProfilePage is also rendered
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {selectedFile && (
            <div style={{ marginTop: '10px', textAlign: 'center', color: '#555', fontSize: '0.9em' }}>
              <p>Selected file: {selectedFile.name}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {/* <Button type="submit">Save changes</Button> // Example save button */}
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
