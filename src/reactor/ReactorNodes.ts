import { random } from "./ReactorMath";

export interface ReactorNode {

    x:number;

    y:number;

    z:number;

    radius:number;

    orbit:number;

    angle:number;

    speed:number;

}

export function createNodes(){

    const nodes:ReactorNode[]=[];

    const rings=[

        {count:8,orbit:55},

        {count:14,orbit:90},

        {count:18,orbit:125},

    ];

    for(const ring of rings){

        for(let i=0;i<ring.count;i++){

            nodes.push({

                x:0,

                y:0,

                z:random(-1,1),

                radius:random(2.4,4),

                orbit:ring.orbit,

                angle:
                    Math.PI*2*i/
                    ring.count,

                speed:
                    random(
                        .001,
                        .0025
                    ),

            });

        }

    }

    return nodes;

}

export function updateNodes(

    nodes:ReactorNode[],

    cx:number,

    cy:number

){

    for(const node of nodes){

        node.angle+=node.speed;

        node.z=Math.sin(node.angle);

        const scale=
            .65+
            (node.z+1)*.35;

        node.x=

            cx+

            Math.cos(node.angle)*

            node.orbit*

            scale;

        node.y=

            cy+

            Math.sin(node.angle)*

            node.orbit;

    }

}