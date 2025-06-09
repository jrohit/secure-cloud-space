import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { pdfjs } from "react-pdf";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
// Pages
import DashboardLayout from "./components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard/Dashboard";
import TrashPage from "./pages/Dashboard/TrashPage"; // Import TrashPage
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/ProfilePage"; // Import ProfilePage
import Register from "./pages/Register";

import pdfWorkerEntryPoint from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url"; // New import

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerEntryPoint; // Changed to use Vite's worker URL

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="my-drive" element={<Dashboard />} />
              <Route path="recent" element={<Dashboard />} />
              <Route path="starred" element={<Dashboard />} />
              <Route path="shared" element={<Dashboard />} />
              <Route path="trash" element={<TrashPage />} />{" "}
              {/* Use TrashPage here */}
              <Route path="settings" element={<Dashboard />} />
              {/* Consider if /dashboard/profile is more appropriate if settings is also under /dashboard */}
            </Route>

            {/* Profile Page Route - Protected and within DashboardLayout */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ProfilePage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
