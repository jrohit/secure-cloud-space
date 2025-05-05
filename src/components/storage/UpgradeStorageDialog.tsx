
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, filesApi } from "@/services/api";
import { useState, useEffect } from "react";
import { StoragePlan, StorageInfo } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import { Check, HardDrive } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface UpgradeStorageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storageInfo?: StorageInfo;
  onUpgrade?: () => void;
}

const UpgradeStorageDialog: React.FC<UpgradeStorageDialogProps> = ({ 
  open, 
  onOpenChange,
  storageInfo: externalStorageInfo,
  onUpgrade 
}) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [storagePlans, setStoragePlans] = useState<StoragePlan[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(externalStorageInfo || null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (open && token) {
      loadData();
    }
  }, [open, token]);

  const loadData = async () => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const [plans, info] = await Promise.all([
        usersApi.getStoragePlans(token),
        externalStorageInfo ? null : filesApi.getStorageInfo(token)
      ]);
      
      setStoragePlans(plans);
      if (info) setStorageInfo(info);
    } catch (error) {
      console.error("Error loading storage data:", error);
      toast({
        title: "Error",
        description: "Failed to load storage plans",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (!token) return;
    
    setIsUpgrading(true);
    try {
      await usersApi.upgradeStorage(token, planId);
      toast({
        title: "Success",
        description: "Storage plan upgraded successfully",
      });
      
      if (onUpgrade) onUpgrade();
      onOpenChange(false);
    } catch (error) {
      console.error("Upgrade error:", error);
      toast({
        title: "Error",
        description: "Failed to upgrade storage plan",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const formatStorageSize = (size: number): string => {
    return `${size} GB`;
  };

  const isPlanActive = (planId: string): boolean => {
    return storageInfo?.storageType === planId;
  };

  if (!token) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upgrade Storage</DialogTitle>
          <DialogDescription>
            Choose a storage plan that suits your needs.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            {storagePlans.map((plan) => (
              <Card key={plan.id} className={`${isPlanActive(plan.id) ? 'border-primary' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {isPlanActive(plan.id) && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        Current
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {formatStorageSize(plan.size)} Storage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}/month`}
                  </div>
                  <div className="flex items-center mt-4">
                    <HardDrive className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{formatStorageSize(plan.size)} cloud storage</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    variant={isPlanActive(plan.id) ? "outline" : "default"}
                    disabled={isUpgrading || isPlanActive(plan.id)}
                    className="w-full"
                  >
                    {isUpgrading ? (
                      <Spinner className="h-4 w-4 mr-2" />
                    ) : isPlanActive(plan.id) ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Current Plan
                      </>
                    ) : (
                      'Upgrade'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeStorageDialog;
