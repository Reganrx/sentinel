export default function Pulse() {

    return (

        <g className="pulse">

            {/*==================================================
                PRIMARY ENERGY RINGS
            ==================================================*/}

            <circle

                className="pulse-ring primary"

                cx="400"

                cy="400"

                r="56"

                fill="none"

            />

            <circle

                className="pulse-ring secondary"

                cx="400"

                cy="400"

                r="76"

                fill="none"

            />

            <circle

                className="pulse-ring tertiary"

                cx="400"

                cy="400"

                r="96"

                fill="none"

            />

            {/*==================================================
                ENERGY RIPPLES
            ==================================================*/}

            {

                Array.from({ length: 12 }).map((_, index) => (

                    <g

                        key={index}

                        transform={`rotate(${index * 30} 400 400)`}

                    >

                        <path

                            className="pulse-ripple"

                            d="

                                M400 318

                                C408 328 410 342 400 352

                                C390 342 392 328 400 318

                            "

                        />

                    </g>

                ))

            }

            {/*==================================================
                COMPRESSION NODES
            ==================================================*/}

            {

                Array.from({ length: 24 }).map((_, index) => (

                    <g

                        key={`node-${index}`}

                        transform={`rotate(${index * 15} 400 400)`}

                    >

                        <circle

                            className="pulse-node"

                            cx="400"

                            cy="302"

                            r="2"

                        />

                    </g>

                ))

            }

            {/*==================================================
                INNER SHOCK RING
            ==================================================*/}

            <circle

                className="pulse-ring shock"

                cx="400"

                cy="400"

                r="44"

                fill="none"

            />

            {/*==================================================
                CORE BREATH
            ==================================================*/}

            <circle

                className="core-breath"

                cx="400"

                cy="400"

                r="30"

            />

        </g>

    );

}