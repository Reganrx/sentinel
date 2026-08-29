export default function Core() {

    return (

        <g className="core">

            {/*==================================================
                OUTER ENERGY AURA
            ==================================================*/}

            <circle

                className="outer-plasma"

                cx="400"

                cy="400"

                r="88"

            />

            <circle

                className="plasma-shell"

                cx="400"

                cy="400"

                r="74"

            />

            {/*==================================================
                SWIRL BLADES
            ==================================================*/}

            {

                Array.from({ length: 16 }).map((_, index) => (

                    <g

                        key={index}

                        transform={`rotate(${index * 22.5} 400 400)`}

                    >

                        <path

                            className="core-swirl"

                            d="

                                M400 330

                                C410 340 418 356 412 374

                                C404 364 398 350 400 330

                            "

                        />

                    </g>

                ))

            }

            {/*==================================================
                PLASMA FILAMENTS
            ==================================================*/}

            {

                Array.from({ length: 12 }).map((_, index) => (

                    <g

                        key={`filament-${index}`}

                        transform={`rotate(${index * 30} 400 400)`}

                    >

                        <path

                            className="core-filament"

                            d="

                                M400 344

                                C420 362 420 388 400 408

                                C380 388 380 362 400 344

                            "

                        />

                    </g>

                ))

            }

            {/*==================================================
                HOTSPOTS
            ==================================================*/}

            {

                [

                    [381,381],

                    [419,392],

                    [406,422],

                    [378,410],

                    [394,362],

                    [423,372],

                    [390,432],

                    [412,380]

                ].map(([x, y], i) => (

                    <circle

                        key={i}

                        className="core-hotspot"

                        cx={x}

                        cy={y}

                        r="4"

                    />

                ))

            }

            {/*==================================================
                FUSION CORE
            ==================================================*/}

            <circle

                className="fusion-kernel"

                cx="400"

                cy="400"

                r="38"

            />

            <circle

                className="kernel-glow"

                cx="400"

                cy="400"

                r="24"

            />

            <circle

                className="core-centre"

                cx="400"

                cy="400"

                r="10"

            />

            {/*==================================================
                ENERGY NODES
            ==================================================*/}

            {

                Array.from({ length: 8 }).map((_, index) => (

                    <g

                        key={`node-${index}`}

                        transform={`rotate(${index * 45} 400 400)`}

                    >

                        <circle

                            className="status-light"

                            cx="400"

                            cy="316"

                            r="3"

                        />

                    </g>

                ))

            }

            {/*==================================================
                INNER CONTAINMENT
            ==================================================*/}

            <circle

                className="inner-plasma-ring"

                cx="400"

                cy="400"

                r="50"

                fill="none"

            />

            <circle

                className="inner-plasma-ring secondary"

                cx="400"

                cy="400"

                r="58"

                fill="none"

            />

        </g>

    );

}