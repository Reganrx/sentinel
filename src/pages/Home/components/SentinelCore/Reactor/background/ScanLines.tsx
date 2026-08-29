export default function ScanLines() {

    return (

        <g className="scan-lines">

            {/*==================================================
                HORIZONTAL SCAN BANDS
            ==================================================*/}

            {

                Array.from({ length: 80 }).map((_, index) => (

                    <line

                        key={`scan-${index}`}

                        x1="90"

                        y1={110 + index * 7}

                        x2="710"

                        y2={110 + index * 7}

                        stroke="#AEEFFF"

                        strokeWidth=".45"

                        opacity={index % 5 === 0 ? ".035" : ".015"}

                    />

                ))

            }

            {/*==================================================
                VERTICAL SENSOR LINES
            ==================================================*/}

            {

                Array.from({ length: 28 }).map((_, index) => (

                    <line

                        key={`vertical-${index}`}

                        x1={150 + index * 18}

                        y1="120"

                        x2={150 + index * 18}

                        y2="680"

                        stroke="#8EDFFF"

                        strokeWidth=".25"

                        opacity=".018"

                    />

                ))

            }

            {/*==================================================
                RANGE MARKERS
            ==================================================*/}

            {

                [180,230,280,330,470,520,570,620].map((y,index)=>(

                    <line

                        key={`marker-${index}`}

                        x1="115"

                        y1={y}

                        x2="140"

                        y2={y}

                        stroke="#D9FCFF"

                        strokeWidth=".7"

                        opacity=".08"

                    />

                ))

            }

            {/*==================================================
                SENSOR POINTS
            ==================================================*/}

            {

                Array.from({ length: 36 }).map((_, index)=>(

                    <circle

                        key={`point-${index}`}

                        cx={110 + ((index * 17) % 580)}

                        cy={145 + ((index * 29) % 510)}

                        r=".7"

                        fill="#FFFFFF"

                        opacity=".04"

                    />

                ))

            }

            {/*==================================================
                SCANNING ARC
            ==================================================*/}

            <path

                d="
                    M145 400
                    A255 255 0 0 1 655 400
                "

                fill="none"

                stroke="#7EE8FF"

                strokeWidth=".8"

                strokeDasharray="8 14"

                opacity=".06"

            />

            {/*==================================================
                INNER SCANNING ARC
            ==================================================*/}

            <path

                d="
                    M190 400
                    A210 210 0 0 1 610 400
                "

                fill="none"

                stroke="#BDF8FF"

                strokeWidth=".5"

                strokeDasharray="5 10"

                opacity=".05"

            />

            {/*==================================================
                DIGITAL NOISE
            ==================================================*/}

            {

                Array.from({ length: 120 }).map((_, index)=>(

                    <rect

                        key={`noise-${index}`}

                        x={95 + ((index * 41) % 610)}

                        y={95 + ((index * 23) % 610)}

                        width="1"

                        height="1"

                        fill="#FFFFFF"

                        opacity=".02"

                    />

                ))

            }

        </g>

    );

}