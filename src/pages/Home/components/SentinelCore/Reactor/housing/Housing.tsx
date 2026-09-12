import OuterSegments from "./OuterSegments";
import ArmourModule from "./ArmourModule";
import OuterDetails from "./OuterDetails";
import LockAssembly from "./LockAssembly";

export default function Housing() {

    return (

        <g className="housing">

            <OuterSegments />

            <ArmourModule type={"power"} index={0} />

            <OuterDetails />

            <LockAssembly />

        </g>

    );

}