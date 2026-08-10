import * as React from "react";
import type * as DialogPrimitiveTypes from "@radix-ui/react-dialog";

declare module "@/components/ui/dialog" {
  export const Dialog: React.FC<DialogPrimitiveTypes.DialogProps>;
  export const DialogPortal: React.FC<DialogPrimitiveTypes.DialogPortalProps>;
  export const DialogOverlay: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<any>
  >;
  export const DialogClose: React.FC<DialogPrimitiveTypes.DialogCloseProps>;
  export const DialogTrigger: React.ForwardRefExoticComponent<
    DialogPrimitiveTypes.DialogTriggerProps & React.RefAttributes<any>
  >;

  type DialogContentSize =
    | "xs"
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "5xl"
    | "full";

  export interface DialogContentProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, "className"> {
    className?: string;
    size?: DialogContentSize;
    overlayClass?: string;
    overlayScroll?: boolean;
    hiddenCloseIcon?: boolean;
    children?: React.ReactNode;
  }

  export const DialogContent: React.ForwardRefExoticComponent<
    DialogContentProps & React.RefAttributes<HTMLDivElement>
  >;

  export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>>;

  export const DialogTitle: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLHeadingElement> & React.RefAttributes<HTMLHeadingElement>
  >;

  export const DialogDescription: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>
  >;
}
