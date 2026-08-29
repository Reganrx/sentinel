import "./Badge.css";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Badge({
  children,
}: Props) {
  return (
    <span className="ui-badge">
      {children}
    </span>
  );
}