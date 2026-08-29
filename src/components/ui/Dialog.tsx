import "./Dialog.css";

import { ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export default function Dialog({
  open,
  title,
  children,
  onClose,
}: Props) {

  if (!open) return null;

  return (

    <div
      className="dialog-overlay"
      onClick={onClose}
    >

      <div
        className="dialog"
        onClick={(e)=>e.stopPropagation()}
      >

        <div className="dialog-header">

          <h2>{title}</h2>

        </div>

        <div className="dialog-content">

          {children}

        </div>

      </div>

    </div>

  );

}