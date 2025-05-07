
import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { userEncryptionService } from "@/services/api/userEncryption";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string>("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate inputs
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    // Check password strength
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }
    
    try {
      // Create encryption key based on user credentials
      const { masterKey, encryptedMasterKey, salt, iv, tag } = userEncryptionService.generateMasterKeyAndParams(password);

      // Register user with encrypted master key
      const registeredUser = await authApi.register({
        name,
        email,
        password,
        encryptionData: {
          encryptedMasterKey,
          iv,
          salt,
          tag
        }
      });

      // Log in the user
      const loginData = await authApi.login({ email, password });
      
      // Store master key for this session
      userEncryptionService.saveMasterKey(loginData.user.id, masterKey);

      // Update auth context
      login(loginData.token, loginData.user, masterKey);

      toast.success("Registration successful!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error?.message || "Failed to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cloudDrive-blue/10 to-cloudDrive-green/10">
      <div className="mx-auto flex w-full max-w-md flex-col rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-8 flex items-center justify-center">
          <div className="mr-2 h-14 w-14 rounded-full bg-gradient-to-r from-cloudDrive-blue to-cloudDrive-green flex items-center justify-center text-white text-xl font-bold">
            MLC
          </div>
          <h1 className="text-2xl font-bold tracking-tighter">My Local Cloud</h1>
        </div>
        <h1 className="mb-6 text-2xl font-semibold text-center">Create an Account</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={passwordError ? "border-destructive" : ""}
            />
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={password !== confirmPassword ? "border-destructive" : ""}
            />
            {password !== confirmPassword && (
              <p className="text-sm text-destructive">Passwords do not match</p>
            )}
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {isLoading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
        
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
