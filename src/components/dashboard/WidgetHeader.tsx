import "./WidgetHeader.css";

import type {
  LucideIcon,
} from "lucide-react";

import Icon from "../common/Icon";

interface WidgetHeaderProps {

  title: string;

  subtitle?: string;

  icon?: LucideIcon;

}

export default function WidgetHeader({

  title,

  subtitle,

  icon,

}: WidgetHeaderProps) {

  return (

    <header className="widget-header">

      <div className="widget-title">

        {icon && (

          <div className="widget-icon">

            <Icon

              icon={icon}

            />

          </div>

        )}

        <div className="widget-heading">

          <h2>

            {title}

          </h2>

          {subtitle && (

            <p>

              {subtitle}

            </p>

          )}

        </div>

      </div>

    </header>

  );

}