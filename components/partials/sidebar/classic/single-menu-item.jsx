"use client";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { cn, isLocationMatch, translate, getDynamicPath, useLocalizedPath } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";

const SingleMenuItem = ({ item, collapsed, hovered, trans }) => {
  const { badge, href, title } = item;

  const pathname = usePathname();
  const locationName = getDynamicPath(pathname);
  const localize = useLocalizedPath();
  const isExpanded = !collapsed || hovered;
  const IconComponent = item.icon;

  return (
    <Link href={localize(href)}>
      <div
        className={cn(
          "flex w-full items-center text-default-700 text-sm capitalize font-medium py-3 rounded cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors duration-150",
          {
            "px-[10px] gap-3 justify-start": isExpanded,
            "px-0 justify-center": !isExpanded,
            "bg-primary text-primary-foreground": isLocationMatch(
              href, locationName
            ),
          }
        )}
      >
        <span className="shrink-0">
          {IconComponent ? (
            <IconComponent className="w-5 h-5" />
          ) : (
            <div className="w-5 h-5 bg-gray-300 rounded" />
          )}
        </span>
        {isExpanded && <div className="text-box grow truncate">{translate(title, trans)}</div>}
        {isExpanded && badge && <Badge className=" rounded">{item.badge}</Badge>}
      </div>
    </Link>
  );
};

export default SingleMenuItem;
