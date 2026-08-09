"use client";
import { Inter } from "next/font/google";
import { useThemeStore } from "@/store";
import { ThemeProvider } from "next-themes";
import { cn } from "@/lib/utils";
import { ReactToaster } from "@/components/ui/toaster";
import { Toaster } from "react-hot-toast";
import { SonnToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMounted } from "@/hooks/use-mounted";

const inter = Inter({ subsets: ["latin"] });
const Providers = ({ children }) => {
  const { theme, radius } = useThemeStore();
  const mounted = useMounted();
  const resolvedTheme = mounted ? theme : "light";

  return (
    <div
      className={cn("dash-tail-app ", inter.className, "theme-" + resolvedTheme)}
      style={{
        "--radius": `${radius}rem`,
      }}
    >
      <ThemeProvider
        attribute="class"
        enableSystem={false}
        defaultTheme="light"
      >
        <TooltipProvider delayDuration={120}>
          <div className={cn("h-full", `theme-${resolvedTheme}`)}>
            {children}
            <ReactToaster />
          </div>
          <Toaster />
          <SonnToaster />
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};

export default Providers;
