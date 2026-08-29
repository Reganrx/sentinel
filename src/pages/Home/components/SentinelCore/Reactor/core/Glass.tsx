export default function Glass() {

    return (

        <g className="glass">

            {/*==================================================
                OUTER GLASS BODY
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="192"

                fill="url(#glass)"

                opacity=".94"

            />

            {/*==================================================
                LAMINATED OUTER RING
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="191"

                fill="none"

                stroke="#D7F8FF"

                strokeWidth="1.5"

                opacity=".30"

            />

            <circle

                cx="400"

                cy="400"

                r="186"

                fill="none"

                stroke="#8FC5D6"

                strokeWidth=".8"

                opacity=".16"

            />

            {/*==================================================
                PRESSURE LAYER
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="176"

                fill="url(#glass)"

                opacity=".18"

            />

            {/*==================================================
                INNER REFRACTION RING
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="166"

                fill="none"

                stroke="#E9FCFF"

                strokeWidth=".8"

                opacity=".15"

            />

            {/*==================================================
                FRESNEL RINGS
            ==================================================*/}

            {

                [156,150,144,138,132].map(radius=>(

                    <circle

                        key={radius}

                        cx="400"

                        cy="400"

                        r={radius}

                        fill="none"

                        stroke="#FFFFFF"

                        strokeWidth=".45"

                        opacity=".035"

                    />

                ))

            }

            {/*==================================================
                PRIMARY REFLECTION
            ==================================================*/}

            <ellipse

                cx="345"

                cy="332"

                rx="58"

                ry="24"

                fill="#FFFFFF"

                opacity=".14"

                transform="rotate(-28 345 332)"

            />

            {/*==================================================
                SECONDARY REFLECTION
            ==================================================*/}

            <ellipse

                cx="460"

                cy="465"

                rx="36"

                ry="14"

                fill="#FFFFFF"

                opacity=".05"

                transform="rotate(32 460 465)"

            />

            {/*==================================================
                EDGE BLOOM
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="192"

                fill="none"

                stroke="#D7F9FF"

                strokeWidth="5"

                opacity=".05"

            />

            {/*==================================================
                INNER SHADOW
            ==================================================*/}

            <circle

                cx="400"

                cy="400"

                r="162"

                fill="none"

                stroke="#091016"

                strokeWidth="10"

                opacity=".18"

            />

        </g>

    );

}