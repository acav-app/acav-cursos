import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import type { buttonVariants } from "./button";

declare module "@/components/ui/button" {
  type ButtonVariantProps = VariantProps<typeof buttonVariants>;

  export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    variant?: ButtonVariantProps["variant"];
    size?: ButtonVariantProps["size"];
    color?: ButtonVariantProps["color"];
  }

  export const Button: React.ForwardRefExoticComponent<
    ButtonProps & React.RefAttributes<HTMLButtonElement>
  >;

  export { buttonVariants };
}
