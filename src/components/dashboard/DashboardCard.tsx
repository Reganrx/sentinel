import "./DashboardCard.css";

import type {
  ReactNode,
} from "react";

import type {
  LucideIcon,
} from "lucide-react";

import WidgetHeader from "./WidgetHeader";

interface DashboardCardProps {

  title: string;

  subtitle?: string;

  icon?: LucideIcon;

  className?: string;

  children: ReactNode;

}

export default function DashboardCard({

  title,

  subtitle,

  icon,

  className = "",

  children,

}: DashboardCardProps) {

  return (

    <section className={`dashboard-card ${className}`}>

      <WidgetHeader

        title={title}

        subtitle={subtitle}

        icon={icon}

      />

      <div className="dashboard-card-body">

        {children}

      </div>

    </section>

  );

}