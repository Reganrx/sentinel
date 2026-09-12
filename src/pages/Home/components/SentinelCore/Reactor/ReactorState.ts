export type ReactorState =
    | "offline"
    | "idle"
    | "listening"
    | "thinking"
    | "streaming"
    | "speaking"
    | "warning";

export interface ReactorStateConfig {

    rotationSpeed: number;

    pulseSpeed: number;

    pulseScale: number;

    glow: number;

    plasmaIntensity: number;

    particleSpeed: number;

    clampOffset: number;

    colour: string;

}

export const ReactorStates: Record<ReactorState, ReactorStateConfig> = {

    offline: {

        rotationSpeed: 0,
        pulseSpeed: 0,
        pulseScale: 1,
        glow: 0,
        plasmaIntensity: 0,
        particleSpeed: 0,
        clampOffset: 0,
        colour: "#666"

    },

    idle: {

        rotationSpeed: .15,
        pulseSpeed: 8,
        pulseScale: 1.03,
        glow: .35,
        plasmaIntensity: .35,
        particleSpeed: .2,
        clampOffset: 0,
        colour: "#5EDCFF"

    },

    listening: {

        rotationSpeed: .2,
        pulseSpeed: 2,
        pulseScale: 1.06,
        glow: .45,
        plasmaIntensity: .45,
        particleSpeed: .4,
        clampOffset: 1,
        colour: "#57D4FF"

    },

    thinking: {

        rotationSpeed: .35,
        pulseSpeed: 1.2,
        pulseScale: 1.08,
        glow: .75,
        plasmaIntensity: .75,
        particleSpeed: .8,
        clampOffset: 2,
        colour: "#80F5FF"

    },

    streaming: {

        rotationSpeed: .65,
        pulseSpeed: .7,
        pulseScale: 1.12,
        glow: 1,
        plasmaIntensity: 1,
        particleSpeed: 1.2,
        clampOffset: 3,
        colour: "#B8FFFF"

    },

    speaking: {

        rotationSpeed: .25,
        pulseSpeed: .9,
        pulseScale: 1.1,
        glow: .85,
        plasmaIntensity: .7,
        particleSpeed: .9,
        clampOffset: 2,
        colour: "#89F3FF"

    },

    warning: {

        rotationSpeed: 1,
        pulseSpeed: .3,
        pulseScale: 1.2,
        glow: 1,
        plasmaIntensity: 1,
        particleSpeed: 2,
        clampOffset: 5,
        colour: "#FF8A42"

    }

};