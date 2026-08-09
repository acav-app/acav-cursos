import { create } from "zustand";
import { siteConfig } from "@/config/site";
import { persist, createJSONStorage } from "zustand/middleware";

const FORCED_LAYOUT = "semibox";

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: siteConfig.theme,
      setTheme: (theme) => set({ theme }),
      radius: siteConfig.radius,
      setRadius: (value) => set({ radius: value }),
      layout: FORCED_LAYOUT,
      setLayout: (_value) => {
        set({ layout: FORCED_LAYOUT });

        if (FORCED_LAYOUT === "semibox") {
          useSidebar.setState({ sidebarType: "popover" });
        }
        if (FORCED_LAYOUT === "horizontal") {
          useSidebar.setState({ sidebarType: "classic" });
          useThemeStore.setState({ navbarType: "sticky" });
        }
      },
      navbarType: siteConfig.navbarType,
      setNavbarType: (value) => set({ navbarType: value }),
      footerType: siteConfig.footerType,
      setFooterType: (value) => set({ footerType: value }),
      isRtl: false,
      setRtl: (value) => set({ isRtl: value }),
    }),
    {
      name: "theme-store",
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState && typeof persistedState === "object" ? persistedState : {};
        if ((version || 0) < 2) {
          return {
            ...state,
            theme: siteConfig.theme,
            radius: siteConfig.radius,
            layout: FORCED_LAYOUT,
            navbarType: siteConfig.navbarType,
          };
        }
        return { ...state, layout: FORCED_LAYOUT };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.layout = FORCED_LAYOUT;
          const sidebarStore = useSidebar.getState();
          if (FORCED_LAYOUT === "semibox" && sidebarStore.sidebarType !== "popover") {
            sidebarStore.setSidebarType("popover");
          } else if (FORCED_LAYOUT === "horizontal" && sidebarStore.sidebarType !== "classic") {
            sidebarStore.setSidebarType("classic");
          }
        }
      },
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const useSidebar = create(
  persist(
    (set) => ({
      collapsed: false,
      setCollapsed: (value) => set({ collapsed: value }),
      sidebarType:
        FORCED_LAYOUT === "semibox" ? "popover" : siteConfig.sidebarType,
      setSidebarType: (value) => {
        set({ sidebarType: value });
      },
      subMenu: false,
      setSubmenu: (value) => set({ subMenu: value }),
      // background image
      sidebarBg: siteConfig.sidebarBg,
      setSidebarBg: (value) => set({ sidebarBg: value }),
      mobileMenu: false,
      setMobileMenu: (value) => set({ mobileMenu: value }),
    }),
    {
      name: "sidebar-store",
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState && typeof persistedState === "object" ? persistedState : {};
        if ((version || 0) < 1) {
          const sidebarType =
            FORCED_LAYOUT === "semibox"
              ? "popover"
              : FORCED_LAYOUT === "horizontal"
                ? "classic"
                : siteConfig.sidebarType;
          return { ...state, sidebarType };
        }
        const sidebarType =
          FORCED_LAYOUT === "semibox"
            ? "popover"
            : FORCED_LAYOUT === "horizontal"
              ? "classic"
              : state.sidebarType || siteConfig.sidebarType;
        return { ...state, sidebarType };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (FORCED_LAYOUT === "semibox") {
            state.sidebarType = "popover";
          } else if (FORCED_LAYOUT === "horizontal") {
            state.sidebarType = "classic";
          }
        }
      },
      storage: createJSONStorage(() => localStorage),
    }
  )
);
