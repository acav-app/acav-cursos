import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { themes } from "@/config/themes";
import { useThemeStore } from "@/store";
import { useTheme } from "next-themes";
import { VerticalSvg, HorizontalSvg, SemiBoxSvg } from "@/components/svg";

import { Icon } from "@iconify/react";

const FORCED_LAYOUT_KEY = "semibox";
const DISABLED_LAYOUTS = ["vertical", "horizontal"];

const layoutOptions = [
  {
    key: "vertical",
    label: "Vertical",
    svg: (
      <VerticalSvg className="[&>rect]:fill-default-300 [&>circle]:fill-default-400 [&>path]:fill-default-400" />
    ),
  },
  {
    key: "horizontal",
    label: "Horizontal",
    svg: (
      <HorizontalSvg className="[&>rect]:fill-default-300 [&>circle]:fill-default-400 [&>path]:fill-default-400" />
    ),
  },
  {
    key: "semibox",
    label: "Semi-Box",
    svg: (
      <SemiBoxSvg className="[&>rect]:fill-default-300 [&>circle]:fill-default-400 [&>path]:fill-default-400" />
    ),
  },
];

const SelectLayout = () => {
  const { layout, setLayout } = useThemeStore();
  const { theme, setTheme, resolvedTheme: mode } = useTheme();
  const { theme: config, setTheme: setConfig } = useThemeStore();
  const newTheme = themes.find((theme) => theme.name === config);

  const handleClick = (key) => {
    if (key !== FORCED_LAYOUT_KEY) return;
    setLayout(FORCED_LAYOUT_KEY);
  };

  const isDisabled = (key) => DISABLED_LAYOUTS.includes(key);

  return (
    <div
      style={{
        "--theme-primary": `hsl(${
          newTheme?.cssVars[mode === "dark" ? "dark" : "light"].primary
        })`,
      }}
    >
      <div className="mb-2 relative inline-block px-3 py-[3px] rounded-md before:bg-(--theme-primary) before:absolute before:top-0 before:left-0 before:w-full  before:h-full before:rounded before:opacity-10 before:z-[-1]  text-(--theme-primary)  text-xs font-medium">
        Layout
      </div>
      <div className="mb-4 grid gap-1">
        <div className="text-muted-foreground font-normal text-xs">Solo modo Semi-Box disponible</div>
        <div className="text-[11px] text-slate-400 leading-5">
          La plataforma opera permanentemente en layout Semi-Box. Los demás estilos están desactivados por configuración global.
        </div>
      </div>
      <div className=" grid grid-cols-3 gap-3">
        {layoutOptions.map((layoutOption) => {
          const disabled = isDisabled(layoutOption.key);
          const active = layout === layoutOption.key || layoutOption.key === FORCED_LAYOUT_KEY;
          return (
            <div key={layoutOption.key}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleClick(layoutOption.key)}
                className={cn(
                  "border-solid border block rounded relative h-[72px] w-full transition-colors",
                  disabled
                    ? "cursor-not-allowed opacity-40 border-border/60 grayscale"
                    : "cursor-pointer",
                  {
                    "text-primary border-primary!": active && !disabled,
                    "text-primary border-primary! opacity-70": active && disabled,
                    "text-muted-foreground border-border": !active,
                  }
                )}
              >
                {active && (
                  <Icon
                    icon="heroicons:check-circle-20-solid"
                    className="text-primary absolute top-1 right-1"
                  />
                )}
                {layoutOption.svg}
              </button>

              <Label
                className={cn(
                  "font-normal block mt-2",
                  disabled ? "text-slate-400" : "text-muted-foreground"
                )}
              >
                {layoutOption.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SelectLayout;
