import "./DropdownMenu.css";

import { ReactNode } from "react";

type MenuItem = {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
};

type Props = {
  open: boolean;
  items: MenuItem[];
};

export default function DropdownMenu({
  open,
  items,
}: Props) {
  if (!open) return null;

  return (
    <div className="dropdown-menu">

      {items.map((item, index) => (

        <button
          key={index}
          className={
            item.danger
              ? "dropdown-danger"
              : ""
          }
          onClick={item.onClick}
        >

          {item.icon}

          <span>{item.label}</span>

        </button>

      ))}

    </div>
  );
}