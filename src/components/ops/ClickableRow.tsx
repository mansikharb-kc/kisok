"use client";

import { useRouter } from "next/navigation";

export default function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    // Don't trigger navigation if the click is on an interactive element (links, buttons, inputs, etc.)
    if (
      target.closest("a") ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("label") ||
      window.getSelection()?.toString()
    ) {
      return;
    }
    router.push(href);
  };

  return (
    <tr onClick={handleRowClick} className={className}>
      {children}
    </tr>
  );
}
