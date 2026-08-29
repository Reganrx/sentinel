export default function EnergyFlow() {

    return (

        <g className="energy-flow">

            {/*==================================================
                PRIMARY TRANSFER STREAMS
            ==================================================*/}

            {

                Array.from({ length: 8 }).map((_, index) => (

                    <g

                        key={`stream-${index}`}

                        className="energy-stream"

                        transform={`rotate(${index * 45} 400 400)`}

                    >

                        <path

                            d="
                                M400 288
                                C396 308 392 326 400 344
                                C408 326 404 308 400 288
                            "

                            fill="none"

                            stroke="url(#plasma)"

                            strokeWidth="3"

                            strokeLinecap="round"

                        />

                    </g>

                ))

            }

            {/*==================================================
                SECONDARY FEEDBACK LOOPS
            ==================================================*/}

            {

                Array.from({ length: 8 }).map((_, index) => (

                    <g

                        key={`feedback-${index}`}

                        transform={`rotate(${index * 45 + 22.5} 400 400)`}

                    >

                        <path

                            d="
                                M400 304
                                C412 316 416 330 408 344
                            "

                            fill="none"

                            stroke="#B8F8FF"

                            strokeWidth="1.2"

                            opacity=".32"

                            strokeLinecap="round"

                        />

                    </g>

                ))

            }

            {/*==================================================
                ENERGY PACKETS
            ==================================================*/}

            {

                Array.from({ length: 16 }).map((_, index) => (

                    <g

                        key={`packet-${index}`}

                        className="energy-packet"

                        transform={`rotate(${index * 22.5} 400 400)`}

                    >

                        <circle

                            cx="400"

                            cy="314"

                            r="2.5"

                            fill="#FFFFFF"

                        />

                        <circle

                            cx="400"

                            cy="314"

                            r="6"

                            fill="url(#plasma)"

                            opacity=".25"

                        />

                    </g>

                ))

            }

            {/*==================================================
                INNER CIRCULATION RING
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="88"

                fill="none"

                stroke="url(#plasma)"

                strokeWidth="1.2"

                opacity=".25"

            />

            {/*==================================================
                FIELD INTERFERENCE
            ==================================================*/}

            {

                Array.from({ length: 12 }).map((_, index) => (

                    <g

                        key={`field-${index}`}

                        transform={`rotate(${index * 30} 400 400)`}

                    >

                        <path

                            d="
                                M400 320
                                C406 324 410 332 406 340
                            "

                            fill="none"

                            stroke="#E8FEFF"

                            strokeWidth=".8"

                            opacity=".14"

                        />

                    </g>

                ))

            }

            {/*==================================================
                MICRO DISCHARGES
            ==================================================*/}

            {

                Array.from({ length: 24 }).map((_, index) => (

                    <g

                        key={`spark-${index}`}

                        transform={`rotate(${index * 15} 400 400)`}

                    >

                        <line

                            x1="400"

                            y1="332"

                            x2="400"

                            y2="336"

                            stroke="#FFFFFF"

                            strokeWidth=".7"

                            opacity=".18"

                        />

                    </g>

                ))

            }

        </g>

    );

}