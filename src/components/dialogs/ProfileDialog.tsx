import React, { useState, useEffect, ChangeEvent } from 'react';
import * as RechartsPrimitive from "recharts"; // For BarChart, XAxis etc.
import {
  ChartContainer,
  // ChartTooltip, // Not directly used if using custom Tooltip in BarChart
  // ChartTooltipContent, // Will use custom content in BarChart's Tooltip prop
  type ChartConfig
} from "@/components/ui/chart";
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

// Helper function to format bytes
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose }) => {
  const { user, updateUserAvatar, refreshUserStorageInfo } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAvatarEnlarged, setIsAvatarEnlarged] = useState(false); // State for enlarged view

  useEffect(() => {
    if (isOpen && refreshUserStorageInfo) {
      refreshUserStorageInfo();
    }
  }, [isOpen, refreshUserStorageInfo]);

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

  const sUsed = user?.storageUsed || 0;
  const sLimit = user?.storageLimit || 1; // Avoid division by zero for percentage calculation, actual display is fine.
                                        // Ensure limit is at least 1 for domain if sUsed is 0.
  const chartData = [{ name: 'Storage', used: sUsed, limit: Math.max(sLimit, sUsed, 1) }]; // Ensure domain max is at least used or 1

  const chartConfig = {
    used: {
      label: 'Used',
      color: 'hsl(var(--primary))',
    },
    limit: { // For background or tooltip
      label: 'Limit',
      color: 'hsl(var(--muted))',
    }
  } satisfies ChartConfig;

  return (
    <>
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
            <div className="mb-5 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h3 className="mt-0 mb-2 pb-2 text-lg font-semibold border-b border-border">Account Details</h3>
              <p className="my-1 text-sm"><strong>Name:</strong> {user.name || 'N/A'}</p>
              <p className="my-1 text-sm"><strong>Email:</strong> {user.email || 'N/A'}</p>
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
                margin: '0 auto 15px auto',
                cursor: previewUrl && !previewUrl.endsWith('/placeholder.svg') ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (previewUrl && !previewUrl.endsWith('/placeholder.svg')) {
                  setIsAvatarEnlarged(true);
                }
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

          {/* Storage Quota Chart */}
          <div className="mt-6"> {/* Increased top margin */}
            <h4 className="mb-2 text-md font-semibold text-foreground">Storage Quota</h4>
            {(user?.storageLimit !== undefined && user?.storageUsed !== undefined) ? (
              <>
                <ChartContainer config={chartConfig} className="h-[40px] w-full"> {/* Adjusted height */}
                  <RechartsPrimitive.BarChart
                    accessibilityLayer
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 0, right: 0, top: 0, bottom: 0 }} // Adjusted margins
                  >
                    <RechartsPrimitive.XAxis type="number" domain={[0, chartData[0].limit]} hide />
                    <RechartsPrimitive.YAxis type="category" dataKey="name" hide />
                    <RechartsPrimitive.Tooltip
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const usedVal = payload[0].payload.used;
                          const limitVal = payload[0].payload.limit;
                          const percentage = limitVal > 0 ? (usedVal / limitVal) * 100 : 0;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
                              <p className="text-foreground">
                                {formatBytes(usedVal)} used
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ({percentage.toFixed(1)}% of {formatBytes(limitVal)})
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <RechartsPrimitive.Bar
                      dataKey="used"
                      fill="var(--color-used)"
                      radius={4}
                      background={{ fill: "hsl(var(--muted))", radius: 4 }}
                      barSize={20} // Adjusted bar size
                    />
                  </RechartsPrimitive.BarChart>
                </ChartContainer>
                <div className="mt-1 text-xs text-muted-foreground text-center">
                  {formatBytes(sUsed)} of {formatBytes(sLimit)}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Storage information not available.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          {/* <Button type="submit">Save changes</Button> // Example save button */}
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {isAvatarEnlarged && previewUrl && !previewUrl.endsWith('/placeholder.svg') && (
      <Dialog open={isAvatarEnlarged} onOpenChange={setIsAvatarEnlarged}>
        <DialogContent className="p-0 max-w-fit flex justify-center items-center bg-transparent border-0 shadow-none">
          <img
            src={previewUrl}
            alt="Enlarged Avatar"
            className="max-w-[80vw] max-h-[80vh] object-contain rounded-md"
          />
        </DialogContent>
      </Dialog>
    )}
  </>
  );
};

export default ProfileDialog;
