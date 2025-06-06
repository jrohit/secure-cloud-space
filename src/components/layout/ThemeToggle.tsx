import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  // Determine the current effective theme, even if 'system' is set
  const [effectiveTheme, setEffectiveTheme] = React.useState(theme);

  React.useEffect(() => {
    if (theme === "system") {
      setEffectiveTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
      );
    } else {
      setEffectiveTheme(theme);
    }

    // Listener for system theme changes to update the icon when theme is 'system'
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () =>
        setEffectiveTheme(mediaQuery.matches ? "dark" : "light");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const toggleTheme = () => {
    // If current theme is 'system', toggling should switch to 'light' or 'dark' explicitly.
    // Or, if we want to cycle through 'light' -> 'dark' -> 'system', the logic would be different.
    // For a simple light/dark toggle that can override 'system':
    if (effectiveTheme === "light") {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {effectiveTheme === "dark" ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
    </Button>
  );
};
