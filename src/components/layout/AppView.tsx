import "./AppView.css";

import type {
  ReactNode,
} from "react";

import PageHeader from "./PageHeader";

interface AppViewProps {

  title: string;

  subtitle?: string;

  showHeader?: boolean;

  actions?: ReactNode;

  children: ReactNode;

  className?: string;

}

export default function AppView({

  title,

  subtitle,

  showHeader = true,

  actions,

  children,

  className = "",

}: AppViewProps) {

  return (

    <section

      className={`app-view ${className}`}

    >

      {showHeader && (

        <PageHeader

          title={title}

          subtitle={subtitle}

          actions={actions}

        />

      )}

      <div className="app-view-body">

        {children}

      </div>

    </section>

  );

}