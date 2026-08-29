import ArmourModule from "./ArmourModule";

export type ModuleType =
    | "power"
    | "cooling"
    | "sensor"
    | "maintenance";

const MODULE_LAYOUT: ModuleType[] = [

    "power",
    "cooling",
    "power",
    "sensor",

    "power",
    "maintenance",

    "power",
    "cooling",

    "power",
    "sensor",

    "power",
    "maintenance"

];

export default function OuterSegments() {

    return (

        <g className="outer-segments">

            {/*==================================================
                OUTER STRUCTURAL RING
            ==================================================*/}

            <circle

                className="outer-segment"

                cx="400"

                cy="400"

                r="252"

                fill="none"

            />

            {/*==================================================
                INNER STRUCTURAL RING
            ==================================================*/}

            <circle

                className="outer-segment secondary"

                cx="400"

                cy="400"

                r="228"

                fill="none"

            />

            {/*==================================================
                OUTER SEGMENTS
            ==================================================*/}

            {

                MODULE_LAYOUT.map((type, index) => (

                    <g

                        key={`${type}-${index}`}

                        transform={`rotate(${index * 30} 400 400)`}

                    >

                        <path

                            className="outer-segment"

                            d="

                                M384 146

                                L416 146

                                L430 164

                                L424 218

                                L414 232

                                L386 232

                                L376 218

                                L370 164

                                Z

                            "

                        />

                        <path

                            className="outer-detail"

                            d="

                                M388 160

                                L412 160

                                L416 176

                                L412 212

                                L388 212

                                L384 176

                                Z

                            "

                        />

                        <ArmourModule

                            type={type}

                            index={index}

                        />

                    </g>

                ))

            }

            {/*==================================================
                RETAINING RING
            ==================================================*/}

            <circle

                className="outer-detail"

                cx="400"

                cy="400"

                r="214"

                fill="none"

            />

        </g>

    );

}