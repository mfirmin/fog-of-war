
import {
    BufferAttribute,
    BufferGeometry,
    DataTexture,
    Group,
    Mesh,
    ShaderMaterial,
} from './lib/three.module';

const dummyTexture = new DataTexture(new Uint8Array([255, 0, 0, 0]), 1, 1);
dummyTexture.needsUpdate = true;

export class Fog3D {
    constructor(width, height, depth, yOffset) {
        const hWidth = 0.5 * width;
        const hHeight = 0.5 * height;

        const y0 = yOffset;
        const y1 = y0 + depth;

        const A = [-hWidth, y0, hHeight];
        const B = [hWidth, y0, hHeight];
        const C = [hWidth, y0, -hHeight];
        const D = [-hWidth, y0, -hHeight];

        const E = [-hWidth, y1, hHeight];
        const F = [hWidth, y1, hHeight];
        const G = [hWidth, y1, -hHeight];
        const H = [-hWidth, y1, -hHeight];

        const vbuffer = new Float32Array([
            ...A, ...B, ...F,
            ...A, ...F, ...E,

            ...B, ...C, ...G,
            ...B, ...G, ...F,

            ...C, ...D, ...H,
            ...C, ...H, ...G,

            ...D, ...A, ...E,
            ...D, ...E, ...H,

            ...E, ...F, ...G,
            ...E, ...G, ...H,

            ...D, ...C, ...B,
            ...D, ...B, ...A,
        ]);


        const geom = new BufferGeometry();
        geom.addAttribute('position', new BufferAttribute(vbuffer, 3));

        geom.computeBoundingBox();

        this.createMaterial();
        const mesh = new Mesh(geom, this.material);

        this.group = new Group();

        this.group.add(mesh);

        this.group.position.y = yOffset;
    }

    createMaterial() {
        this.material = new ShaderMaterial({
            transparent: true,
            uniforms: {
                lightsource: { type: 'v3', value: [1, 1, 0.0] },
                t: { type: 'f', value: 0.0 },
                revealPoint: { type: 'v3', value: [0, 0, 0] },
            },
            extensions: {
                derivatives: true,
            },
            vertexShader: `
                varying vec3 vPosition;

                void main() {
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 lightsource;
                uniform float t;
                uniform vec3 revealPoint;

                void main() {
                    vec3 L = normalize(lightsource);
                    vec3 color = vec3(1.0, 0.0, 0.0);

                    float alpha = 1.0;


                    gl_FragColor = vec4(color, alpha);
                }
            `,
        });
    }

    setLight(lightsource) {
        this.group.children[0].material.uniforms.lightsource.value = [
            lightsource[0],
            lightsource[1],
            lightsource[2],
        ];
    }

    setTime(t) {
        this.group.children[0].material.uniforms.t.value = t;
    }

    setRevealPoint(pt) {
        this.group.children[0].material.uniforms.revealPoint.value.x = pt.x;
        this.group.children[0].material.uniforms.revealPoint.value.y = pt.y;
        this.group.children[0].material.uniforms.revealPoint.value.z = pt.z;
    }
}
