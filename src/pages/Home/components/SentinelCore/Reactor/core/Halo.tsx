export default function Halo() {

    return (

        <g className="halo">

            {/*==================================================
                OUTER HALO
            ==================================================*/}

            <circle

                className="halo-ring"

                cx="400"

                cy="400"

                r="176"

                fill="none"

            />

            <circle

                className="halo-ring secondary"

                cx="400"

                cy="400"

                r="168"

                fill="none"

            />

            {/*==================================================
                MAGNETIC FIELD ARCS
            ==================================================*/}

            {

                Array.from({ length: 12 }).map((_, index) => (

                    <g

                        key={index}

                        transform={`rotate(${index * 30} 400 400)`}

                    >

                        <path

                            className="halo-arc"

                            d="

                                M400 224

                                C434 232 452 258 452 298

                            "

                        />

                        <path

                            className="halo-arc"

                            d="

                                M400 224

                                C366 232 348 258 348 298

                            "

                        />

                    </g>

                ))

            }

            {/*==================================================
                FIELD NODES
            ==================================================*/}

            {

                Array.from({ length: 24 }).map((_, index) => (

                    <g

                        key={`node-${index}`}

                        transform={`rotate(${index * 15} 400 400)`}

                    >

                        <circle

                            className="halo-node"

                            cx="400"

                            cy="232"

                            r="2"

                        />

                    </g>

                ))

            }

            {/*==================================================
                STABILISERS
            ==================================================*/}

            {

                Array.from({ length: 8 }).map((_, index) => (

                    <g

                        key={`stab-${index}`}

                        transform={`rotate(${index * 45} 400 400)`}

                    >

                        <path

                            className="halo-stabiliser"

                            d="

                                M382 244

                                L418 244

                                L414 254

                                L386 254

                                Z

                            "

                        />

                    </g>

                ))

            }

            {/*==================================================
                INNER HALO
            ==================================================*/}

            <circle

                className="halo-ring tertiary"

                cx="400"

                cy="400"

                r="156"

                fill="none"

            />

            <circle

                className="halo-ring quaternary"

                cx="400"

                cy="400"

                r="148"

                fill="none"

            />

        </g>

    );

}