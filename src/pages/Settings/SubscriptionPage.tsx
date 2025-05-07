
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Check, CreditCard } from "lucide-react";
import { PlanOption } from "@/types";

const plans: PlanOption[] = [
  {
    id: "free",
    name: "Free Plan",
    description: "Basic storage for personal use",
    price: 0,
    features: ["5GB Storage", "File Encryption", "File Sharing"],
    storageGB: 5,
  },
  {
    id: "pro",
    name: "Pro Plan",
    description: "Enhanced storage with extra features",
    price: 4.99,
    features: [
      "20GB Storage",
      "File Encryption",
      "File Sharing",
      "Priority Support",
      "Access to All File Types",
    ],
    storageGB: 20,
    recommended: true,
  },
  {
    id: "premium",
    name: "Premium Plan",
    description: "Professional grade cloud storage solution",
    price: 9.99,
    features: [
      "50GB Storage",
      "File Encryption",
      "File Sharing",
      "Priority Support",
      "Access to All File Types",
      "Advanced Sharing Options",
      "Team Collaboration",
    ],
    storageGB: 50,
  },
  {
    id: "enterprise",
    name: "Enterprise Plan",
    description: "Complete solution for businesses",
    price: 19.99,
    features: [
      "100GB Storage",
      "File Encryption",
      "File Sharing",
      "Priority Support",
      "Access to All File Types",
      "Advanced Sharing Options",
      "Team Collaboration",
      "Admin Controls",
      "Analytics Dashboard",
    ],
    storageGB: 100,
  },
];

const SubscriptionPage = () => {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentPlanId = user?.storageType || "free";

  const handleSelectPlan = (planId: string) => {
    if (planId !== currentPlanId) {
      setSelectedPlan(planId);
    } else {
      setSelectedPlan(null); // Deselect if clicking on current plan
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan || selectedPlan === currentPlanId) return;
    
    setIsProcessing(true);
    try {
      // Here you would implement actual payment processing
      // For now we'll just show a mock implementation
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network request
      
      alert(`Subscription to ${selectedPlan} plan would be processed here`);
      
    } catch (error) {
      console.error("Error processing subscription:", error);
      alert("There was an error processing your subscription");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container max-w-5xl py-8">
      <h1 className="text-3xl font-bold mb-8">Storage Plans</h1>
      
      <div className="mb-8">
        <p className="text-muted-foreground">
          Choose a storage plan that fits your needs. Upgrade anytime as your storage needs grow.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId;
          const isSelected = plan.id === selectedPlan;
          
          return (
            <Card 
              key={plan.id}
              className={`relative overflow-hidden transition-all ${
                plan.recommended ? "border-primary shadow-md" : ""
              } ${
                isSelected ? "ring-2 ring-primary" : ""
              }`}
            >
              {plan.recommended && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs py-1 px-3 rounded-bl-lg">
                  Recommended
                </div>
              )}
              
              {isCurrentPlan && (
                <div className="absolute top-0 left-0 bg-green-500 text-white text-xs py-1 px-3 rounded-br-lg">
                  Current Plan
                </div>
              )}
              
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="mb-4">
                  <span className="text-3xl font-bold">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground ml-1">/month</span>
                  )}
                </div>
                
                <p className="text-muted-foreground mb-6">
                  {plan.description}
                </p>
                
                <div className="space-y-2">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center">
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : "default"}
                  disabled={isCurrentPlan || isProcessing}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {isCurrentPlan ? "Current Plan" : "Select Plan"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      
      {selectedPlan && (
        <div className="flex justify-center">
          <Button 
            size="lg"
            onClick={handleSubscribe}
            disabled={isProcessing}
            className="px-8"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {isProcessing ? "Processing..." : `Subscribe to ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
