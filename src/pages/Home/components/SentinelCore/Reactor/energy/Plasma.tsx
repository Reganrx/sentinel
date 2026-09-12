export default function Plasma() {

    return (

        <g className="plasma">

            {/*==================================================
                OUTER ION CLOUD
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="62"

                fill="url(#plasma)"

                opacity=".10"

            />

            {/*==================================================
                INNER PLASMA CLOUD
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="48"

                fill="url(#plasma)"

                opacity=".18"

            />

            {/*==================================================
                PLASMA FILAMENTS
            ==================================================*/}

            {

                Array.from({ length: 18 }).map((_, index) => (

                    <g

                        key={`filament-${index}`}

                        className="plasma-filament"

                        transform={`rotate(${index * 20} 400 400)`}

                    >

                        <path

                            d="
                                M400 356
                                C392 368 394 382 400 392
                                C406 382 408 368 400 356
                            "

                            fill="none"

                            stroke="#FFFFFF"

                            strokeWidth="1"

                            strokeLinecap="round"

                            opacity=".18"

                        />

                    </g>

                ))

            }

            {/*==================================================
                PLASMA STREAMERS
            ==================================================*/}

            {

                Array.from({ length: 12 }).map((_, index) => (

                    <g

                        key={`stream-${index}`}

                        className="plasma-stream"

                        transform={`rotate(${index * 30 + 15} 400 400)`}

                    >

                        <path

                            d="
                                M400 346
                                C410 360 410 378 400 392
                            "

                            fill="none"

                            stroke="#9EEFFF"

                            strokeWidth=".8"

                            opacity=".22"

                        />

                    </g>

                ))

            }

            {/*==================================================
                ION PARTICLES
            ==================================================*/}

            {

                Array.from({ length: 48 }).map((_, index) => (

                    <g

                        key={`particle-${index}`}

                        className="ion-particle"

                        transform={`rotate(${index * 7.5} 400 400)`}

                    >

                        <circle

                            cx="400"

                            cy="372"

                            r="1.2"

                            fill="#FFFFFF"

                            opacity=".32"

                        />

                    </g>

                ))

            }

            {/*==================================================
                MICRO DISCHARGES
            ==================================================*/}

            {

                Array.from({ length: 20 }).map((_, index) => (

                    <g

                        key={`arc-${index}`}

                        className="micro-arc"

                        transform={`rotate(${index * 18} 400 400)`}

                    >

                        <line

                            x1="400"

                            y1="352"

                            x2="400"

                            y2="360"

                            stroke="#E8FDFF"

                            strokeWidth=".8"

                            opacity=".18"

                        />

                    </g>

                ))

            }

            {/*==================================================
                FUSION GLOW
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="26"

                fill="#FFFFFF"

                opacity=".10"

            />

            {/*==================================================
                THERMAL BLOOM
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="84"

                fill="url(#plasma)"

                opacity=".05"

            />

        </g>

    );

}