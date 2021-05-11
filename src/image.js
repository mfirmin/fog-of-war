
import {
    BackSide,
    BufferAttribute,
    BufferGeometry,
    DataTexture,
    Group,
    Matrix4,
    Mesh,
    ShaderMaterial,
} from './lib/three.module';

const dummyTexture = new DataTexture(new Uint8Array([255, 0, 0, 0]), 1, 1);
dummyTexture.needsUpdate = true;

export class Image {
    constructor(image, width) {
        this.image = image;
        const imageWidth = this.image.image.width;
        const imageHeight = this.image.image.height;

        const height = (width * imageHeight) / imageWidth;

        const hWidth = 0.5 * width;
        const hHeight = 0.5 * height;

        console.log(hWidth);
        console.log(hHeight);

        const vbuffer = new Float32Array([
            -hWidth, 0.0, hHeight,
            hWidth, 0.0, hHeight,
            hWidth, 0.0, -hHeight,

            -hWidth, 0.0, hHeight,
            hWidth, 0.0, -hHeight,
            -hWidth, 0.0, -hHeight,
        ]);

        const nbuffer = new Float32Array([
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,

            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
        ]);
        const uvbuffer = new Float32Array([
            0, 0,
            1, 0,
            1, 1,

            0, 0,
            1, 1,
            0, 1,
        ]);

        const geom = new BufferGeometry();
        geom.addAttribute('position', new BufferAttribute(vbuffer, 3));
        geom.addAttribute('normal', new BufferAttribute(nbuffer, 3));
        geom.addAttribute('uv', new BufferAttribute(uvbuffer, 2));

        geom.computeBoundingBox();

        this.createMaterial();
        const mesh = new Mesh(geom, this.material);

        this.group = new Group();

        this.group.add(mesh);

        this.createShadowMaterial();
    }

    createMaterial() {
        this.material = new ShaderMaterial({
            uniforms: {
                lightsource: { type: 'v3', value: [0, 200, 200] },
                shadowmap: { type: 's', value: dummyTexture },
                depthBiasVP: { type: 'm4', value: new Matrix4() },
                image: { type: 's', value: this.image },
            },
            vertexShader: `
                uniform mat4 depthBiasVP;

                varying vec3 vNormal;

                varying vec3 shadowcoord;

                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    vNormal = normalize((modelMatrix * vec4(normalize(normal), 0.0)).xyz);

                    vec4 dp = (depthBiasVP * modelMatrix * vec4(position, 1.0));
                    shadowcoord = (dp.xyz / dp.w) * 0.5 + 0.5;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 lightsource;
                uniform vec3 color;

                uniform sampler2D image;

                uniform sampler2D shadowmap;

                varying vec3 vNormal;
                varying vec3 shadowcoord;
                varying vec2 vUv;

                const float shadowTolerance = 0.005;

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 L = normalize(lightsource);

                    float d = max(0.0, dot(N, L));
                    float a = 0.3;

                    vec3 color = texture2D(image, vUv).rgb;

                    gl_FragColor = vec4((a + d) * color, 1.0);
                }
            `,
        });
    }

    createShadowMaterial() {
        this.shadowMaterial = new ShaderMaterial({
            uniforms: {
            },
            vertexShader: `
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                void main() {
                    gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
                }
            `,
            side: BackSide,
        });
    }

    setScale(s) {
        this.group.scale.set(s, s, s);
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }

    setShadowMode() {
        this.group.children[0].material = this.shadowMaterial;
    }

    setNormalMode(shadowmap, depthMatrix) {
        this.group.children[0].material = this.material;
        this.material.uniforms.shadowmap.value = shadowmap.texture;
        this.material.uniforms.depthBiasVP.value = depthMatrix;
    }

    setLight(lightsource) {
        this.group.children[0].material.uniforms.lightsource.value = [
            lightsource[0],
            lightsource[1],
            lightsource[2],
        ];
    }
}
