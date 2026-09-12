export default function Hex() {

    const cells = [];

    const spacingX = 18;
    const spacingY = 16;

    const radius = 108;

    const hex = (x: number, y: number) => `

        M ${x - 6} ${y}
        L ${x - 3} ${y - 5}
        L ${x + 3} ${y - 5}
        L ${x + 6} ${y}
        L ${x + 3} ${y + 5}
        L ${x - 3} ${y + 5}
        Z

    `;

    for (let row = -8; row <= 8; row++) {

        for (let col = -8; col <= 8; col++) {

            const x =
                400 +
                col * spacingX +
                (row % 2 ? spacingX / 2 : 0);

            const y =
                400 +
                row * spacingY;

            const dx = x - 400;
            const dy = y - 400;

            if (Math.sqrt(dx * dx + dy * dy) < radius) {

                cells.push(

                    <path
                        key={`${row}-${col}`}
                        className="hex-cell"
                        d={hex(x, y)}
                        fill="none"
                        stroke="#D8FCFF"
                        strokeWidth=".35"
                        opacity=".06"
                    />

                );

            }

        }

    }

    return (

        <g className="hex-lattice">

            {/*==================================================
                GRAPHENE LATTICE
            ==================================================*/}

            {cells}

            {/*==================================================
                RADIAL SUPPORT SPOKES
            ==================================================*/}

            {

                Array.from({ length: 12 }).map((_, index) => (

                    <g
                        key={`spoke-${index}`}
                        className="support-spoke-group"
                        transform={`rotate(${index * 30} 400 400)`}
                    >

                        <line
                            className="support-spoke"
                            x1="400"
                            y1="294"
                            x2="400"
                            y2="506"
                            stroke="#BDF8FF"
                            strokeWidth=".45"
                            opacity=".05"
                        />

                    </g>

                ))

            }

            {/*==================================================
                CONCENTRIC STIFFENERS
            ==================================================*/}

            {

                [44, 66, 88, 108].map((r) => (

                    <circle
                        key={r}
                        className="stiffener-ring"
                        cx="400"
                        cy="400"
                        r={r}
                        fill="none"
                        stroke="#D8FCFF"
                        strokeWidth=".3"
                        opacity=".04"
                    />

                ))

            }

            {/*==================================================
                ANCHOR POINTS
            ==================================================*/}

            {

                Array.from({ length: 24 }).map((_, index) => (

                    <g
                        key={`anchor-${index}`}
                        className="anchor-group"
                        transform={`rotate(${index * 15} 400 400)`}
                    >

                        <circle
                            className="anchor-point"
                            cx="400"
                            cy="292"
                            r="1.4"
                            fill="#EFFFFF"
                            opacity=".15"
                        />

                    </g>

                ))

            }

        </g>

    );

}