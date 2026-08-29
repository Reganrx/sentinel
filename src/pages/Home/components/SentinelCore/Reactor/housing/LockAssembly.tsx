import LockArm from "./LockArm";

export default function LockAssembly() {

    return (

        <g className="lock-assembly">

            {/*==================================================
                LOCK RING
            ==================================================*/}

            <circle

                className="lock-ring"

                cx="400"

                cy="400"

                r="188"

                fill="none"

            />

            {

                Array.from({ length: 8 }).map((_, index) => (

                    <g

                        key={index}

                        transform={`rotate(${index * 45} 400 400)`}

                    >

                        {/*==================================================
                            BASE
                        ==================================================*/}

                        <rect

                            className="armour-plate"

                            x="382"

                            y="164"

                            width="36"

                            height="22"

                            rx="3"

                        />

                        {/*==================================================
                            PIVOT
                        ==================================================*/}

                        <circle

                            className="lock-pin"

                            cx="400"

                            cy="192"

                            r="6"

                        />

                        {/*==================================================
                            GUIDE RAILS
                        ==================================================*/}

                        <rect

                            className="armour-highlight"

                            x="394"

                            y="198"

                            width="3"

                            height="42"

                            rx="1"

                        />

                        <rect

                            className="armour-highlight"

                            x="403"

                            y="198"

                            width="3"

                            height="42"

                            rx="1"

                        />

                        {/*==================================================
                            HYDRAULIC BODY
                        ==================================================*/}

                        <rect

                            className="armour-plate"

                            x="392"

                            y="204"

                            width="16"

                            height="30"

                            rx="3"

                        />

                        {/*==================================================
                            LOCK ARM
                        ==================================================*/}

                        <LockArm />

                        {/*==================================================
                            STATUS SENSOR
                        ==================================================*/}

                        <circle

                            className="status-light"

                            cx="400"

                            cy="220"

                            r="2"

                        />

                        {/*==================================================
                            FASTENERS
                        ==================================================*/}

                        {

                            [

                                [389,174],

                                [411,174],

                                [389,182],

                                [411,182]

                            ].map(([x,y],i)=>(

                                <circle

                                    key={i}

                                    className="armour-highlight"

                                    cx={x}

                                    cy={y}

                                    r="1.4"

                                />

                            ))

                        }

                    </g>

                ))

            }

        </g>

    );

}