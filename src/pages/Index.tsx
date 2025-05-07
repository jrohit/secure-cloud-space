import { Button } from "@/components/ui/button";
import { CloudUpload, Database, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-cloudDrive-blue to-cloudDrive-green py-20 text-white">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 max-w-3xl">
            Secure Cloud Storage for Your Important Files
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl opacity-90">
            Store, share, and access your files from anywhere with end to end
            encryption
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              className="bg-white text-cloudDrive-blue hover:bg-white/90"
              onClick={() => navigate("/register")}
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Choose My Local Cloud
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="flex flex-col items-center text-center p-6 rounded-lg border border-border">
              <div className="w-16 h-16 rounded-full bg-cloudDrive-blue/10 flex items-center justify-center mb-4">
                <CloudUpload className="h-8 w-8 text-cloudDrive-blue" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Easy File Management
              </h3>
              <p className="text-muted-foreground">
                Upload, organize, and access your files with an intuitive
                interface designed for simplicity and efficiency.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col items-center text-center p-6 rounded-lg border border-border">
              <div className="w-16 h-16 rounded-full bg-cloudDrive-green/10 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-cloudDrive-green" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Advanced Security</h3>
              <p className="text-muted-foreground">
                Files are encrypted in transit and at rest, ensuring your
                sensitive data remains protected at all times.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col items-center text-center p-6 rounded-lg border border-border">
              <div className="w-16 h-16 rounded-full bg-cloudDrive-yellow/10 flex items-center justify-center mb-4">
                <Database className="h-8 w-8 text-cloudDrive-yellow" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Reliable Storage</h3>
              <p className="text-muted-foreground">
                Your files are redundantly stored on multiple servers to ensure
                they're always available when you need them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to secure your files?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust My Local Cloud with their
            important documents, photos, and files.
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-cloudDrive-blue to-cloudDrive-green text-white hover:opacity-90 transition-opacity"
            onClick={() => navigate("/register")}
          >
            Create Your Free Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-background border-t">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center flex-col md:flex-row gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cloudDrive-blue to-cloudDrive-green flex items-center justify-center text-white font-bold">
                S
              </div>
              <span className="text-lg font-semibold">My Local Cloud</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} My Local Cloud. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
