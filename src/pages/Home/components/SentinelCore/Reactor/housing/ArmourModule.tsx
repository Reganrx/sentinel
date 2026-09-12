import type { ModuleType } from "./OuterSegments";

export interface ArmourModuleProps {

    type: ModuleType;

    index: number;

}

export default function ArmourModule({

    type

}: ArmourModuleProps) {

    return (

        <g className={`armour-module armour-${type}`}>

            {/*==================================================
                OUTER ARMOUR
            ==================================================*/}

            <path

                className="armour-plate"

                d="

                    M382 178

                    L418 178

                    L428 194

                    L422 248

                    L412 262

                    L388 262

                    L378 248

                    L372 194

                    Z

                "

            />

            {/*==================================================
                INNER ARMOUR
            ==================================================*/}

            <path

                className="armour-highlight"

                d="

                    M389 188

                    L411 188

                    L415 198

                    L411 238

                    L405 248

                    L395 248

                    L389 238

                    L385 198

                    Z

                "

            />

            {

                type === "power" && (

                    <g>

                        {

                            [198, 212, 226].map(y => (

                                <rect

                                    key={y}

                                    className="status-light"

                                    x="394"

                                    y={y}

                                    width="12"

                                    height="5"

                                    rx="2"

                                />

                            ))

                        }

                    </g>

                )

            }

            {

                type === "cooling" && (

                    <g>

                        {

                            Array.from({ length: 7 }).map((_, i) => (

                                <rect

                                    key={i}

                                    className="outer-detail"

                                    x={391 + i * 3}

                                    y="194"

                                    width="2"

                                    height="42"

                                />

                            ))

                        }

                    </g>

                )

            }

            {

                type === "sensor" && (

                    <g>

                        <circle

                            className="status-light"

                            cx="400"

                            cy="208"

                            r="8"

                        />

                        <circle

                            className="armour-highlight"

                            cx="400"

                            cy="208"

                            r="3"

                        />

                    </g>

                )

            }

            {

                type === "maintenance" && (

                    <g>

                        <rect

                            className="outer-detail"

                            x="392"

                            y="196"

                            width="16"

                            height="34"

                            rx="2"

                        />

                        <line

                            className="armour-highlight"

                            x1="392"

                            y1="213"

                            x2="408"

                            y2="213"

                        />

                    </g>

                )

            }

            {/*==================================================
                LOWER STATUS NODE
            ==================================================*/}

            <circle

                className="status-light"

                cx="400"

                cy="248"

                r="2.8"

            />

            {/*==================================================
                RETAINING BOLTS
            ==================================================*/}

            {

                [

                    [386, 194],

                    [414, 194],

                    [390, 248],

                    [410, 248]

                ].map(([x, y], i) => (

                    <circle

                        key={i}

                        className="armour-highlight"

                        cx={x}

                        cy={y}

                        r="1.6"

                    />

                ))

            }

        </g>

    );

}