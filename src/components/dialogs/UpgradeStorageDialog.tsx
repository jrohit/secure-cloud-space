import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Added for a close button
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext"; // To get current usage

// Helper function (can be moved to a utils file if used elsewhere)
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

interface UpgradeStorageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const storagePlans = [
  { name: "Default", sizeGB: 5, price: "Free", current: true }, // Assuming 5GB is current default
  { name: "Basic", sizeGB: 20, price: "$5/month (example)" },
  { name: "Pro", sizeGB: 50, price: "$10/month (example)" },
  { name: "Business", sizeGB: 100, price: "$20/month (example)" }, // Changed 80GB to 100GB for consistency with request
];

const UpgradeStorageDialog: React.FC<UpgradeStorageDialogProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const { user } = useAuth();

  const currentStorageUsed = user?.storageUsed ?? 0;
  const currentStorageLimit = user?.storageLimit ?? 5 * 1024 * 1024 * 1024; // Default to 5GB if not set on user

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Upgrade Your Storage</DialogTitle>
          <DialogDescription>
            You are currently using {formatBytes(currentStorageUsed)} of{" "}
            {formatBytes(currentStorageLimit)}. Choose a plan below to increase
            your storage capacity.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {storagePlans.map((plan) => (
            <div
              key={plan.name}
              className={`p-4 border rounded-lg ${plan.current ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "dark:border-gray-700"}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold">
                    {plan.name} - {plan.sizeGB} GB
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {plan.price}
                  </p>
                </div>
                {plan.current ? (
                  <Button variant="outline" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      alert(
                        `Selected ${plan.name} plan. Payment integration coming soon!`,
                      )
                    }
                  >
                    Choose Plan
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="sm:justify-start">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Payment integration (Stripe, Razorpay) will be available soon. Plan
            selection is currently for informational purposes.
          </p>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="mt-2 sm:mt-0 sm:ml-auto"
            >
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeStorageDialog;
