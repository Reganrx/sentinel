import "./CommandPalette.css";

import { Search } from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createCommands,
  scoreCommand,
} from "./commands";

import {
  useNavigation,
} from "../navigation/NavigationContext";

import {
  useCommand,
} from "./CommandContext";

export default function CommandPalette() {

  const [query, setQuery] =
    useState("");

  const [selected, setSelected] =
    useState(0);

  const {
    navigate,
  } = useNavigation();

  const {
    closePalette,
  } = useCommand();

  const commands =
    useMemo(

      () =>

        createCommands(

          page => {

            navigate(page);

            closePalette();

          }

        ),

      [

        navigate,

        closePalette,

      ]

    );

  const filtered =
    useMemo(() => {

      return commands

        .map(

          command => ({

            command,

            score:

              scoreCommand(

                command,

                query

              ),

          })

        )

        .filter(

          result =>

            result.score > 0

        )

        .sort(

          (a, b) =>

            b.score - a.score

        )

        .map(

          result =>

            result.command

        );

    }, [

      commands,

      query,

    ]);

  useEffect(() => {

    setSelected(0);

  }, [

    query,

  ]);

  useEffect(() => {

    function handleKeyDown(

      event: KeyboardEvent

    ) {

      switch (event.key) {

        case "ArrowDown":

          event.preventDefault();

          setSelected(

            value =>

              Math.min(

                value + 1,

                filtered.length - 1

              )

          );

          break;

        case "ArrowUp":

          event.preventDefault();

          setSelected(

            value =>

              Math.max(

                value - 1,

                0

              )

          );

          break;

        case "Enter":

          event.preventDefault();

          filtered[selected]?.action();

          break;

      }

    }

    window.addEventListener(

      "keydown",

      handleKeyDown

    );

    return () =>

      window.removeEventListener(

        "keydown",

        handleKeyDown

      );

  }, [

    filtered,

    selected,

  ]);

  return (

    <div

      className="command-overlay"

      onClick={closePalette}

    >

      <div

        className="command-palette"

        onClick={event =>

          event.stopPropagation()

        }

      >

        <div className="command-search">

          <Search size={20} />

          <input

            type="text"

            placeholder="Ask Sentinel..."

            value={query}

            onChange={event =>

              setQuery(

                event.target.value

              )

            }

            autoFocus

          />

        </div>

        <div className="command-results">

          {filtered.length === 0 && (

            <div className="command-empty">

              No matching commands

            </div>

          )}

          {filtered.map(

            (

              command,

              index

            ) => {

              const Icon =

                command.icon;

              return (

                <button

                  key={command.id}

                  className={

                    selected === index

                      ? "command-item active"

                      : "command-item"

                  }

                  onMouseEnter={() =>

                    setSelected(

                      index

                    )

                  }

                  onClick={

                    command.action

                  }

                >

                  <div className="command-icon">

                    <Icon size={20} />

                  </div>

                  <div className="command-content">

                    <div className="command-header">

                      <h3>

                        {command.title}

                      </h3>

                      {command.shortcut && (

                        <span className="command-shortcut">

                          {command.shortcut}

                        </span>

                      )}

                    </div>

                    <p>

                      {command.subtitle}

                    </p>

                    <small>

                      {command.category}

                    </small>

                  </div>

                </button>

              );

            }

          )}

        </div>

      </div>

    </div>

  );

}