export default function EnergyRing() {

    return (

        <g className="energy-ring">

            {/*==================================================
                OUTER CONDUCTOR
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="138"

                fill="none"

                stroke="#2D3D4C"

                strokeWidth="12"

            />

            <circle

                cx="400"

                cy="400"

                r="138"

                fill="none"

                stroke="url(#plasma)"

                strokeWidth="1.4"

                opacity=".28"

            />

            {/*==================================================
                INNER CONDUCTOR
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="126"

                fill="none"

                stroke="#202A33"

                strokeWidth="6"

            />

            {/*==================================================
                POWER BUS SEGMENTS
            ==================================================*/}

            {

                Array.from({ length: 16 }).map((_, index) => (

                    <g

                        key={index}

                        transform={`rotate(${index * 22.5} 400 400)`}

                    >

                        <path

                            d="
                                M390 262
                                L410 262
                                L414 286
                                L386 286
                                Z
                            "

                            fill="#394651"

                            stroke="#8EA3B6"

                            strokeWidth=".6"

                        />

                    </g>

                ))

            }

            {/*==================================================
                ENERGY INJECTORS
            ==================================================*/}

            {

                Array.from({ length: 8 }).map((_, index) => (

                    <g

                        key={`injector-${index}`}

                        transform={`rotate(${index * 45} 400 400)`}

                    >

                        <rect

                            x="396"

                            y="278"

                            width="8"

                            height="22"

                            rx="3"

                            fill="#A8F3FF"

                            opacity=".45"

                        />

                    </g>

                ))

            }

            {/*==================================================
                TRANSFER NODES
            ==================================================*/}

            {

                Array.from({ length: 24 }).map((_, index) => (

                    <g

                        key={`node-${index}`}

                        transform={`rotate(${index * 15} 400 400)`}

                    >

                        <circle

                            cx="400"

                            cy="270"

                            r="2.2"

                            fill="#DFFFFF"

                            opacity=".42"

                        />

                    </g>

                ))

            }

            {/*==================================================
                CONDUCTOR HIGHLIGHT
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="132"

                fill="none"

                stroke="#FFFFFF"

                strokeWidth=".8"

                opacity=".08"

            />

            {/*==================================================
                INNER TRANSFER RING
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="116"

                fill="none"

                stroke="#89EFFF"

                strokeWidth="1"

                opacity=".18"

            />

        </g>

    );

}