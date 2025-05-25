import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deriveKeyFromPassword,
  encryptMasterKey,
  generateMasterKey,
  generateSalt,
} from "../lib/cryptoUtils";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const validatePasswords = () => {
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return false;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswords()) return;

    setIsSubmitting(true);

    try {
      // 1. Generate a raw master key
      const rawMasterKey = await generateMasterKey();

      // 2. Generate a salt
      const salt = generateSalt(16);

      // 3. Derive a Key Encryption Key (KEK)
      const kek = await deriveKeyFromPassword(password, salt);

      // 4. Convert the raw master key to ArrayBuffer
      const masterKeyArrayBuffer = base64ToArrayBuffer(rawMasterKey);

      // 5. Encrypt the master key
      const encryptedMasterKeyData = await encryptMasterKey(
        masterKeyArrayBuffer,
        kek
      );

      // 6. Convert salt, iv, and ciphertext to base64 strings
      const saltBase64 = arrayBufferToBase64(salt);
      const ivBase64 = arrayBufferToBase64(encryptedMasterKeyData.iv);
      const ciphertextBase64 = arrayBufferToBase64(
        encryptedMasterKeyData.ciphertext
      );

      // 7. Concatenate the base64 strings
      const encryptedMasterKey = `${saltBase64}:${ivBase64}:${ciphertextBase64}`;

      await register(name, email, password, encryptedMasterKey);
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-cloudDrive-blue/5 to-cloudDrive-green/5">
      <div className="w-full max-w-md animate-fade-in">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cloudDrive-blue to-cloudDrive-green flex items-center justify-center text-white font-bold text-xl">
                  S
                </div>
                <h2 className="text-2xl font-bold">SecureCloudSpace</h2>
              </div>
            </div>
            <CardTitle className="text-2xl">Create an account</CardTitle>
            <CardDescription>
              Enter your information to create your account
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Full Name
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="confirm-password"
                  className="text-sm font-medium"
                >
                  Confirm Password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                {passwordError && (
                  <p className="text-destructive text-sm">{passwordError}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-cloudDrive-blue to-cloudDrive-green hover:opacity-90 transition-opacity"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Spinner className="h-5 w-5 mr-2" /> : null}
                Sign up
              </Button>
              <div className="text-center text-sm">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-cloudDrive-blue hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Register;
