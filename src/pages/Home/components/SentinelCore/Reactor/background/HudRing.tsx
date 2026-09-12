export default function HudRing() {

    return (

        <g className="hud-ring">

            {/*==================================================
                PRIMARY CALIBRATION RING
            ==================================================*/}

            <circle
                cx="400"
                cy="400"
                r="342"
                fill="none"
                stroke="#6EDFFF"
                strokeWidth=".8"
                opacity=".08"
            />

            {/*==================================================
                OUTER INDEX TICKS
            ==================================================*/}

            {

                Array.from({ length: 180 }).map((_, index) => (

                    <g
                        key={`major-${index}`}
                        transform={`rotate(${index * 2} 400 400)`}
                    >

                        <line
                            x1="400"
                            y1="48"
                            x2="400"
                            y2={index % 15 === 0 ? "66" : "58"}
                            stroke="#B9F8FF"
                            strokeWidth={index % 15 === 0 ? "1" : ".45"}
                            opacity={index % 15 === 0 ? ".30" : ".12"}
                        />

                    </g>

                ))

            }

            {/*==================================================
                INNER CALIBRATION RING
            ==================================================*/}

            <circle
                cx="400"
                cy="400"
                r="324"
                fill="none"
                stroke="#84EAFF"
                strokeWidth=".6"
                opacity=".06"
            />

            {/*==================================================
                QUADRANT MARKERS
            ==================================================*/}

            {

                [0,90,180,270].map(angle=>(

                    <g

                        key={angle}

                        transform={`rotate(${angle} 400 400)`}

                    >

                        <line

                            x1="400"

                            y1="74"

                            x2="400"

                            y2="108"

                            stroke="#E7FDFF"

                            strokeWidth="2"

                            opacity=".35"

                        />

                        <circle

                            cx="400"

                            cy="116"

                            r="3"

                            fill="#D9FCFF"

                            opacity=".45"

                        />

                    </g>

                ))

            }

            {/*==================================================
                DIAGNOSTIC ARCS
            ==================================================*/}

            <path
                d="
                    M215 120
                    A325 325 0 0 1 585 120
                "
                fill="none"
                stroke="#7EE6FF"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity=".10"
            />

            <path
                d="
                    M635 240
                    A325 325 0 0 1 635 560
                "
                fill="none"
                stroke="#7EE6FF"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity=".10"
            />

            <path
                d="
                    M215 680
                    A325 325 0 0 0 585 680
                "
                fill="none"
                stroke="#7EE6FF"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity=".10"
            />

            <path
                d="
                    M165 240
                    A325 325 0 0 0 165 560
                "
                fill="none"
                stroke="#7EE6FF"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity=".10"
            />

            {/*==================================================
                SENSOR NODES
            ==================================================*/}

            {

                Array.from({ length: 24 }).map((_, index)=>(

                    <g

                        key={`sensor-${index}`}

                        transform={`rotate(${index*15} 400 400)`}

                    >

                        <circle

                            cx="400"

                            cy="76"

                            r="1.6"

                            fill="#BDF8FF"

                            opacity=".30"

                        />

                    </g>

                ))

            }

            {/*==================================================
                ALIGNMENT CROSSHAIR
            ==================================================*/}

            <line

                x1="398"

                y1="18"

                x2="398"

                y2="42"

                stroke="#FFFFFF"

                strokeWidth=".6"

                opacity=".18"

            />

            <line

                x1="402"

                y1="18"

                x2="402"

                y2="42"

                stroke="#FFFFFF"

                strokeWidth=".6"

                opacity=".18"

            />

            <line

                x1="18"

                y1="398"

                x2="42"

                y2="398"

                stroke="#FFFFFF"

                strokeWidth=".6"

                opacity=".18"

            />

            <line

                x1="18"

                y1="402"

                x2="42"

                y2="402"

                stroke="#FFFFFF"

                strokeWidth=".6"

                opacity=".18"

            />

            <line

                x1="758"

                y1="398"

                x2="782"

                y2="398"

                stroke="#FFFFFF"

                strokeWidth=".6"

                opacity=".18"

            />

            <line

                x1="758"

                y1="402"

                x2="782"

                y2="402"

                stroke="#FFFFFF"

                strokeWidth=".6"

                opacity=".18"

            />

            <line

                x1="398"

                y1="758"

                x2="398"

                y2="782"

                stroke="#FFFFFF"

                strokeWidth=".6"

                opacity=".18"

            />

            <line

                x1="402"

                y1="758"

                x2="402"

                y2="782"

                stroke="#FFFFFF"

                strokeWidth=".6"

                opacity=".18"

            />

        </g>

    );

}