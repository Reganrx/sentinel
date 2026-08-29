import "./GlassPanel.css";

import type {
  ReactNode,
} from "react";

interface GlassPanelProps {

  title?: string;

  subtitle?: string;

  icon?: ReactNode;

  children: ReactNode;

  className?: string;

}

export default function GlassPanel({

  title,

  subtitle,

  icon,

  children,

  className = "",

}: GlassPanelProps) {

  return (

    <section

      className={`glass-panel ${className}`}

    >

      {(title || subtitle || icon) && (

        <header className="glass-panel-header">

          {icon && (

            <div className="glass-panel-icon">

              {icon}

            </div>

          )}

          <div>

            {title && (

              <h3>

                {title}

              </h3>

            )}

            {subtitle && (

              <p>

                {subtitle}

              </p>

            )}

          </div>

        </header>

      )}

      <div className="glass-panel-content">

        {children}

      </div>

    </section>

  );

}