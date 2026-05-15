import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type IconLabelProps = {
  children: ReactNode;
  icon: LucideIcon;
};

export function IconLabel({ children, icon: Icon }: IconLabelProps) {
  return (
    <span className="icon-label">
      <Icon aria-hidden="true" className="ui-icon" strokeWidth={2.6} />
      <span>{children}</span>
    </span>
  );
}

export function IconOnly({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" className="ui-icon" strokeWidth={2.6} />;
}
