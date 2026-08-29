import "./Sidebar.css";

import {

  availableNavigation,

} from "../../navigation/navigation";

import type {

  NavigationView,

} from "../../navigation/NavigationContext";

import { useSoundEffects } from "../../audio/SoundEffectsContext";
import { useHiddenPages } from "../../services/pageVisibility";

interface SidebarProps {

  currentPage: NavigationView;

  onNavigate: (

    page: NavigationView

  ) => void;

}

export default function Sidebar({

  currentPage,

  onNavigate,

}: SidebarProps) {

  const { playNavigation } = useSoundEffects();
  const hiddenPages = useHiddenPages();

  return (

    <aside className="sidebar">

      <div className="sidebar-logo">

        <div className="sidebar-logo-mark">S</div>

        <div>
          <h2>SENTINEL</h2>
          <span>OS CORE</span>
        </div>

      </div>

      <nav className="sidebar-nav">

        {availableNavigation.filter(item => !hiddenPages.includes(item.id)).map(

          item => {

            const Icon =

              item.icon;

            return (

              <button

                key={item.id}

                className={

                  currentPage === item.id

                    ? "active"

                    : ""

                }

                onClick={() => { playNavigation(); onNavigate(item.id); }}

              >

                <Icon size={20} />

                <span>

                  {item.title}

                </span>

              </button>

            );

          }

        )}

      </nav>

    </aside>

  );

}
