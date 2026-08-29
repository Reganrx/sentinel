export default function OuterDetails() {

    return (

        <g className="outer-details">

            {/*==================================================
                PRIMARY RETAINING RINGS
            ==================================================*/}

            <circle

                className="outer-detail"

                cx="400"

                cy="400"

                r="246"

                fill="none"

            />

            <circle

                className="outer-detail secondary"

                cx="400"

                cy="400"

                r="236"

                fill="none"

            />

            {/*==================================================
                STRUCTURAL BRACES
            ==================================================*/}

            {

                Array.from({ length: 24 }).map((_, index) => (

                    <g

                        key={index}

                        transform={`rotate(${index * 15} 400 400)`}

                    >

                        <path

                            className="outer-detail"

                            d="

                                M396 158

                                L404 158

                                L406 236

                                L394 236

                                Z

                            "

                        />

                    </g>

                ))

            }

            {/*==================================================
                SERVICE CONDUITS
            ==================================================*/}

            {

                Array.from({ length: 12 }).map((_, index) => (

                    <g

                        key={`conduit-${index}`}

                        transform={`rotate(${index * 30} 400 400)`}

                    >

                        <path

                            className="outer-detail"

                            d="

                                M394 236

                                C394 252 394 264 400 278

                                C406 264 406 252 406 236

                            "

                        />

                    </g>

                ))

            }

            {/*==================================================
                COOLING CHANNELS
            ==================================================*/}

            {

                Array.from({ length: 48 }).map((_, index) => (

                    <g

                        key={`channel-${index}`}

                        transform={`rotate(${index * 7.5} 400 400)`}

                    >

                        <rect

                            className="armour-highlight"

                            x="398"

                            y="224"

                            width="4"

                            height="12"

                            rx="1"

                        />

                    </g>

                ))

            }

            {/*==================================================
                LOCATOR PINS
            ==================================================*/}

            {

                Array.from({ length: 24 }).map((_, index) => (

                    <g

                        key={`pin-${index}`}

                        transform={`rotate(${index * 15} 400 400)`}

                    >

                        <circle

                            className="status-light"

                            cx="400"

                            cy="252"

                            r="2.5"

                        />

                    </g>

                ))

            }

            {/*==================================================
                DIAGNOSTIC PORTS
            ==================================================*/}

            {

                Array.from({ length: 8 }).map((_, index) => (

                    <g

                        key={`port-${index}`}

                        transform={`rotate(${index * 45} 400 400)`}

                    >

                        <rect

                            className="armour-plate"

                            x="392"

                            y="258"

                            width="16"

                            height="8"

                            rx="2"

                        />

                    </g>

                ))

            }

            {/*==================================================
                INNER MACHINED RING
            ==================================================*/}

            <circle

                className="outer-detail"

                cx="400"

                cy="400"

                r="214"

                fill="none"

            />

            <circle

                className="outer-detail secondary"

                cx="400"

                cy="400"

                r="206"

                fill="none"

            />

            {/*==================================================
                ALIGNMENT NOTCHES
            ==================================================*/}

            {

                Array.from({ length: 36 }).map((_, index) => (

                    <g

                        key={`notch-${index}`}

                        transform={`rotate(${index * 10} 400 400)`}

                    >

                        <rect

                            className="armour-highlight"

                            x="398"

                            y="204"

                            width="4"

                            height="7"

                            rx="1"

                        />

                    </g>

                ))

            }

        </g>

    );

}