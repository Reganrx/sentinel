import "./QuickAction.css";

import type {
  ReactNode,
} from "react";

interface QuickActionProps {

  title: string;

  subtitle: string;

  icon: ReactNode;

  onClick?: () => void;

}

export default function QuickAction({

  title,

  subtitle,

  icon,

  onClick,

}: QuickActionProps) {

  return (

    <button

      className="quick-action"

      onClick={onClick}

    >

      <div className="quick-action-icon">

        {icon}

      </div>

      <div className="quick-action-text">

        <h3>

          {title}

        </h3>

        <p>

          {subtitle}

        </p>

      </div>

    </button>

  );

}