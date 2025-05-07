
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StoragePlan } from "@/types";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "../ui/Spinner";

interface UpgradeStorageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: (planId: string) => void;
}

export function UpgradeStorageDialog({
  open,
  onOpenChange,
  onUpgrade
}: UpgradeStorageDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const plans: StoragePlan[] = [
    {
      id: "free",
      name: "Free",
      storageGB: 5,
      priceMonthly: 0,
      priceYearly: 0,
      features: ["5GB Storage", "Basic Support", "File Encryption"]
    },
    {
      id: "basic",
      name: "Basic",
      storageGB: 20,
      priceMonthly: 4.99,
      priceYearly: 49.99,
      features: ["20GB Storage", "Priority Support", "Advanced Encryption", "Custom Folders"]
    },
    {
      id: "premium",
      name: "Premium",
      storageGB: 100,
      priceMonthly: 9.99,
      priceYearly: 99.99,
      features: ["100GB Storage", "24/7 Support", "Enterprise-grade Security", "Custom Domains"]
    }
  ];

  const handleUpgrade = async () => {
    if (!selectedPlan) {
      toast({
        title: "No Plan Selected",
        description: "Please select a storage plan to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      // In a real app, this would process payment through a service like Stripe
      
      // For demo purposes, we'll just simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      onUpgrade(selectedPlan);
      onOpenChange(false);
      
      toast({
        title: "Upgrade Successful",
        description: `Your storage plan has been upgraded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upgrade Failed",
        description: "There was an error processing your upgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upgrade Your Storage Plan</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`cursor-pointer transition-all ${
                selectedPlan === plan.id 
                  ? "border-primary ring-2 ring-primary/20" 
                  : "hover:border-primary/50"
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  {plan.storageGB} GB Storage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {plan.priceMonthly === 0 
                    ? "Free" 
                    : `$${plan.priceMonthly}`}
                  <span className="text-sm font-normal">
                    {plan.priceMonthly > 0 ? "/month" : ""}
                  </span>
                </div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center text-sm">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  variant={selectedPlan === plan.id ? "default" : "outline"} 
                  className="w-full"
                  onClick={() => setSelectedPlan(plan.id)}
                  disabled={isLoading}
                >
                  {selectedPlan === plan.id ? "Selected" : "Select"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className="flex justify-end gap-4 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade} disabled={!selectedPlan || isLoading}>
            {isLoading && <Spinner className="mr-2 h-4 w-4" />}
            Upgrade Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
