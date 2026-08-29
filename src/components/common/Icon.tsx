import type {
  LucideIcon,
} from "lucide-react";

interface IconProps {

  icon: LucideIcon;

  size?: number;

  strokeWidth?: number;

}

export default function Icon({

  icon: Icon,

  size = 22,

  strokeWidth = 2,

}: IconProps) {

  return (

    <Icon

      size={size}

      strokeWidth={strokeWidth}

    />

  );

}