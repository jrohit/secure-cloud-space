import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import ScrollToTopButton from "./ScrollToTopButton"; // Import the new component
import { DataRefreshProvider } from "@/contexts/DataRefreshContext"; // Import the provider

const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <DataRefreshProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar toggleSidebar={toggleSidebar} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar collapsed={sidebarCollapsed} />
          <main className="flex-1 p-4 md:p-6 transition-all duration-200">
            <Outlet />
          </main>
        </div>
        <ScrollToTopButton /> {/* Add the button here */}
      </div>
    </DataRefreshProvider>
  );
};

export default DashboardLayout;
