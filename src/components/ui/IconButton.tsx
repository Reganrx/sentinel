import "./IconButton.css";

import { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
};

export default function IconButton({
  icon,
  title,
  onClick,
  danger = false,
  active = false,
}: Props) {
  return (
    <button
      className={[
        "icon-button",
        danger ? "danger" : "",
        active ? "active" : "",
      ].join(" ")}
      title={title}
      onClick={onClick}
      type="button"
    >
      {icon}
    </button>
  );
}