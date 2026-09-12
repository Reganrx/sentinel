export type ReactorState =
    | "offline"
    | "initialising"
    | "idle"
    | "listening"
    | "thinking"
    | "streaming"
    | "speaking"
    | "warning";

export interface ReactorStateConfig {

    colour: string;
    glow: number;
    pulseSpeed: number;
    pulseScale: number;
    rotationSpeed: number;
    plasmaIntensity: number;
    particleSpeed: number;
    clampOffset: number;

}

export const ReactorStates: Record<ReactorState, ReactorStateConfig> = {

    offline:{colour:"#7A7A7A",glow:0,pulseSpeed:999,pulseScale:1,rotationSpeed:0,plasmaIntensity:0,particleSpeed:999,clampOffset:0},

    initialising:{colour:"#63DFFF",glow:.35,pulseSpeed:5,pulseScale:1.04,rotationSpeed:.1,plasmaIntensity:.15,particleSpeed:3,clampOffset:1},

    idle:{colour:"#63DFFF",glow:.45,pulseSpeed:8,pulseScale:1.03,rotationSpeed:.15,plasmaIntensity:.35,particleSpeed:2,clampOffset:0},

    listening:{colour:"#6AE9FF",glow:.55,pulseSpeed:2,pulseScale:1.06,rotationSpeed:.25,plasmaIntensity:.45,particleSpeed:1.2,clampOffset:1},

    thinking:{colour:"#A8F6FF",glow:.85,pulseSpeed:1.1,pulseScale:1.08,rotationSpeed:.4,plasmaIntensity:.75,particleSpeed:.8,clampOffset:2},

    streaming:{colour:"#D9FDFF",glow:1,pulseSpeed:.65,pulseScale:1.12,rotationSpeed:.65,plasmaIntensity:1,particleSpeed:.4,clampOffset:3},

    speaking:{colour:"#88F2FF",glow:.9,pulseSpeed:.9,pulseScale:1.09,rotationSpeed:.3,plasmaIntensity:.8,particleSpeed:.7,clampOffset:2},

    warning:{colour:"#FF9737",glow:1,pulseSpeed:.3,pulseScale:1.2,rotationSpeed:1,plasmaIntensity:1,particleSpeed:.2,clampOffset:5}

};

export default function ReactorDefs(){

    return(

        <defs>

            <linearGradient id="titanium" x1="0%" y1="0%" x2="100%" y2="100%">

                <stop offset="0%" stopColor="#F7F9FB"/>
                <stop offset="20%" stopColor="#D7DEE6"/>
                <stop offset="50%" stopColor="#9CA7B2"/>
                <stop offset="75%" stopColor="#56636E"/>
                <stop offset="100%" stopColor="#1E252C"/>

            </linearGradient>

            <linearGradient id="graphite" x1="0%" y1="0%" x2="100%" y2="100%">

                <stop offset="0%" stopColor="#48525D"/>
                <stop offset="35%" stopColor="#2D353E"/>
                <stop offset="70%" stopColor="#171D23"/>
                <stop offset="100%" stopColor="#090C10"/>

            </linearGradient>

            <radialGradient id="core">

                <stop offset="0%" stopColor="#FFFFFF"/>
                <stop offset="12%" stopColor="#F5FEFF"/>
                <stop offset="35%" stopColor="#C8F8FF"/>
                <stop offset="65%" stopColor="#72E3FF"/>
                <stop offset="100%" stopColor="#00A6F4"/>

            </radialGradient>

            <radialGradient id="plasma">

                <stop offset="0%" stopColor="#FFFFFF"/>
                <stop offset="15%" stopColor="#E9FEFF"/>
                <stop offset="35%" stopColor="#B6F8FF"/>
                <stop offset="70%" stopColor="var(--reactor-colour)"/>
                <stop offset="100%" stopColor="#0087D4" stopOpacity="0"/>

            </radialGradient>

            <radialGradient id="energyField">

                <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".9"/>
                <stop offset="35%" stopColor="#9AEFFF" stopOpacity=".45"/>
                <stop offset="100%" stopColor="#5BCFFF" stopOpacity="0"/>

            </radialGradient>

            <filter id="outerGlow" x="-60%" y="-60%" width="220%" height="220%">

                <feGaussianBlur stdDeviation="12" result="blur"/>

                <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 18 -8"
                    result="bloom"
                />

                <feMerge>

                    <feMergeNode in="bloom"/>
                    <feMergeNode in="SourceGraphic"/>

                </feMerge>

            </filter>

            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">

                <feGaussianBlur stdDeviation="4"/>

            </filter>

            <filter id="coreGlow" x="-100%" y="-100%" width="300%" height="300%">

                <feGaussianBlur stdDeviation="18" result="blur"/>

                <feMerge>

                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>

                </feMerge>

            </filter>

            <filter id="shadow">

                <feDropShadow

                    dx="0"

                    dy="8"

                    stdDeviation="10"

                    floodColor="#000"

                    floodOpacity=".45"

                />

            </filter>

        </defs>

    );

}