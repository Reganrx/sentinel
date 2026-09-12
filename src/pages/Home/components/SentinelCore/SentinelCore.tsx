import "./SentinelCore.css";

import Reactor from "./Reactor/Reactor";

import {

    useSentinel,

} from "../../../../state/SentinelContext";

import { useEffect } from "react";
import { useSoundEffects } from "../../../../audio/SoundEffectsContext";

const STATUS = {

    initialising: "INITIALISING",

    idle: "ONLINE",

    thinking: "THINKING",

    streaming: "GENERATING",

    listening: "LISTENING",

    offline: "OFFLINE",

} as const;

export default function SentinelCore() {

    const {

        state,

    } = useSentinel();

    const { setReactorState } = useSoundEffects();

    useEffect(() => {
        setReactorState(state);
        return () => setReactorState(null);
    }, [setReactorState, state]);

    return (

        <section className="sentinel-core">

            <div className="sentinel-reactor">

                <Reactor
                    state={state}
                />

            </div>

            <div className={`sentinel-state-beacon sentinel-state-beacon--${state}`} aria-hidden="true"><i /><span>{STATUS[state]}</span><i /></div>

            <div className="sentinel-text">

                <h1>

                    SENTINEL

                </h1>

            </div>

        </section>

    );

}
