
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
import {
    OBJLoader,
} from './lib/OBJLoader';

const dummyTexture = new DataTexture(new Uint8Array([255, 0, 0, 0]), 1, 1);
dummyTexture.needsUpdate = true;

export class Entity {
    constructor(vertices, faces, normals, color) {
        if (vertices === undefined) {
            return;
        }
        this.color = color;

        const numFaces = faces.length;
        const numVertices = numFaces * 3;

        const vbuffer = new Float32Array(numVertices * 3);
        const nbuffer = new Float32Array(numVertices * 3);

        for (let i = 0; i < numFaces; i++) {
            const A = faces[i][0];
            const B = faces[i][1];
            const C = faces[i][2];

            vbuffer[(i * 9) + 0] = vertices[(A * 3) + 0];
            vbuffer[(i * 9) + 1] = vertices[(A * 3) + 1];
            vbuffer[(i * 9) + 2] = vertices[(A * 3) + 2];

            vbuffer[(i * 9) + 3] = vertices[(B * 3) + 0];
            vbuffer[(i * 9) + 4] = vertices[(B * 3) + 1];
            vbuffer[(i * 9) + 5] = vertices[(B * 3) + 2];

            vbuffer[(i * 9) + 6] = vertices[(C * 3) + 0];
            vbuffer[(i * 9) + 7] = vertices[(C * 3) + 1];
            vbuffer[(i * 9) + 8] = vertices[(C * 3) + 2];

            nbuffer[(i * 9) + 0] = normals[(A * 3) + 0];
            nbuffer[(i * 9) + 1] = normals[(A * 3) + 1];
            nbuffer[(i * 9) + 2] = normals[(A * 3) + 2];

            nbuffer[(i * 9) + 3] = normals[(B * 3) + 0];
            nbuffer[(i * 9) + 4] = normals[(B * 3) + 1];
            nbuffer[(i * 9) + 5] = normals[(B * 3) + 2];

            nbuffer[(i * 9) + 6] = normals[(C * 3) + 0];
            nbuffer[(i * 9) + 7] = normals[(C * 3) + 1];
            nbuffer[(i * 9) + 8] = normals[(C * 3) + 2];
        }

        const geom = new BufferGeometry();
        geom.addAttribute('position', new BufferAttribute(vbuffer, 3));
        geom.addAttribute('normal', new BufferAttribute(nbuffer, 3));

        geom.computeBoundingBox();

        this.createMaterial();
        const mesh = new Mesh(geom, this.material);

        this.group = new Group();

        this.group.add(mesh);

        this.createShadowMaterial();
    }

    fromOBJ(filename, ready, color = [0.3, 0.7, 0.2]) {
        this.group = null;

        const loader = new OBJLoader();

        console.log(`Loading file ... ${filename}`);

        this.color = color;

        loader.load(
            filename,
            (resource) => {
                this.group = resource;

                this.createMaterial();
                this.createShadowMaterial();

                this.group.children[0].material = this.material;

                ready(this.group);
            },
            (xhr) => {
                console.log(xhr);
            },
            (error) => {
                console.log(error);
            },
        );
    }

    createMaterial() {
        this.material = new ShaderMaterial({
            uniforms: {
                color: { type: 'v3', value: this.color },
                lightsource: { type: 'v3', value: [0, 200, 200] },
                shadowmap: { type: 's', value: dummyTexture },
                depthBiasVP: { type: 'm4', value: new Matrix4() },
            },
            vertexShader: `
                uniform mat4 depthBiasVP;

                varying vec3 vNormal;

                varying vec3 shadowcoord;

                void main() {
                    vNormal = normalize((modelMatrix * vec4(normalize(normal), 0.0)).xyz);

                    vec4 dp = (depthBiasVP * modelMatrix * vec4(position, 1.0));
                    shadowcoord = (dp.xyz / dp.w) * 0.5 + 0.5;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 lightsource;
                uniform vec3 color;

                uniform sampler2D shadowmap;

                varying vec3 vNormal;
                varying vec3 shadowcoord;

                const float shadowTolerance = 0.005;

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 L = normalize(lightsource);

                    float bias = shadowTolerance * tan(acos(dot(N, L)));
                    bias = clamp(bias, 0.0, 0.05);

                    float shadow = 0.0;
                    float rhs = shadowcoord.z - bias;

                    vec2 texelSize = vec2(1.0 / 2048.0);

                    for (int x = -1; x <= 1; ++x) {
                        for (int y = -1; y <= 1; ++y) {
                            float pcfDepth = texture2D(shadowmap, shadowcoord.xy + vec2(x, y) * texelSize).r;
                            shadow += shadowcoord.z - bias > pcfDepth ? 1.0 : 0.0;
                        }
                    }
                    shadow /= 9.0;

                    float d = max(0.0, dot(N, L));
                    float a = 0.3;

                    gl_FragColor = vec4((a + (1.0 - shadow) * d) * color, 1.0);
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
