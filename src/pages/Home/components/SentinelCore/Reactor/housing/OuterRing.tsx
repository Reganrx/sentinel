export default function OuterRing() {

    return (

        <g className="outer-ring">

            {/*==================================================
                PRIMARY STRUCTURAL BODY
            ==================================================*/}

            <circle
                cx="400"
                cy="400"
                r="274"
                fill="url(#graphite)"
                stroke="url(#titanium)"
                strokeWidth="4"
            />

            {/*==================================================
                INNER MACHINED RECESS
            ==================================================*/}

            <circle
                cx="400"
                cy="400"
                r="254"
                fill="none"
                stroke="#11181F"
                strokeWidth="18"
            />

            <circle
                cx="400"
                cy="400"
                r="246"
                fill="none"
                stroke="#697784"
                strokeWidth="1"
                opacity=".25"
            />

            {/*==================================================
                STRUCTURAL SECTORS
            ==================================================*/}

            {

                Array.from({ length: 12 }).map((_, index) => (

                    <g
                        key={index}
                        transform={`rotate(${index * 30} 400 400)`}
                    >

                        <path
                            d="
                                M382 118
                                L418 118
                                L430 145
                                L424 196
                                L376 196
                                L370 145
                                Z
                            "
                            fill="url(#graphite)"
                            stroke="#93A2AE"
                            strokeWidth=".8"
                        />

                    </g>

                ))

            }

            {/*==================================================
                OUTER COOLING SLOTS
            ==================================================*/}

            {

                Array.from({ length: 72 }).map((_, index) => (

                    <g
                        key={`slot-${index}`}
                        transform={`rotate(${index * 5} 400 400)`}
                    >

                        <rect
                            x="398"
                            y="116"
                            width="4"
                            height="10"
                            rx="1"
                            fill="#0B1015"
                        />

                    </g>

                ))

            }

            {/*==================================================
                RECESSED FASTENERS
            ==================================================*/}

            {

                Array.from({ length: 24 }).map((_, index) => (

                    <g
                        key={`bolt-${index}`}
                        transform={`rotate(${index * 15} 400 400)`}
                    >

                        <circle
                            cx="400"
                            cy="136"
                            r="5"
                            fill="#3C4650"
                        />

                        <circle
                            cx="400"
                            cy="136"
                            r="2.2"
                            fill="#AAB5BE"
                        />

                    </g>

                ))

            }

            {/*==================================================
                INNER SUPPORT RING
            ==================================================*/}

            <circle
                cx="400"
                cy="400"
                r="224"
                fill="none"
                stroke="#2B343D"
                strokeWidth="8"
            />

            <circle
                cx="400"
                cy="400"
                r="220"
                fill="none"
                stroke="#8A98A5"
                strokeWidth=".8"
                opacity=".18"
            />

        </g>

    );

}