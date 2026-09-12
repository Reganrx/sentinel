import { ReactNode } from "react";

type Props = {
  left: ReactNode;
  right: ReactNode;
};

export default function Workspace({
  left,
  right,
}: Props) {
  return (
    <main className="workspace">

      <section className="workspace-left">
        {left}
      </section>

      <section className="workspace-right">
        {right}
      </section>

    </main>
  );
}