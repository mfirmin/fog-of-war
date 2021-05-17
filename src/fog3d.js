
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

        this.createMaterial(hWidth, hHeight, y0, y1);
        const mesh = new Mesh(geom, this.material);

        this.group = new Group();

        this.group.add(mesh);

        this.group.position.y = yOffset;
    }

    createMaterial(hWidth, hHeight, y0, y1) {
        this.material = new ShaderMaterial({
            transparent: true,
            uniforms: {
                lightsource: { type: 'v3', value: [1, 1, 0.0] },
                t: { type: 'f', value: 0.0 },
                revealPoint: { type: 'v3', value: [0, 0, 0] },
                stepsize: { type: 'f', value: 0.10 },
                xBounds: { type: 'v2', value: [-hWidth, hWidth] },
                yBounds: { type: 'v2', value: [y0, y1] },
                zBounds: { type: 'v2', value: [-hHeight, hHeight] },
                cameraPos: { type: 'v3', value: [0, 0, 0] },
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
                uniform vec3 revealPoint;
                uniform float t;

                varying vec3 vPosition;


                /* https://www.shadertoy.com/view/XsX3zB
                 *
                 * The MIT License
                 * Copyright © 2013 Nikita Miropolskiy
                 *
                 * ( license has been changed from CCA-NC-SA 3.0 to MIT
                 *
                 *   but thanks for attributing your source code when deriving from this sample
                 *   with a following link: https://www.shadertoy.com/view/XsX3zB )
                 *
                 * ~
                 * ~ if you're looking for procedural noise implementation examples you might
                 * ~ also want to look at the following shaders:
                 * ~
                 * ~ Noise Lab shader by candycat: https://www.shadertoy.com/view/4sc3z2
                 * ~
                 * ~ Noise shaders by iq:
                 * ~     Value    Noise 2D, Derivatives: https://www.shadertoy.com/view/4dXBRH
                 * ~     Gradient Noise 2D, Derivatives: https://www.shadertoy.com/view/XdXBRH
                 * ~     Value    Noise 3D, Derivatives: https://www.shadertoy.com/view/XsXfRH
                 * ~     Gradient Noise 3D, Derivatives: https://www.shadertoy.com/view/4dffRH
                 * ~     Value    Noise 2D             : https://www.shadertoy.com/view/lsf3WH
                 * ~     Value    Noise 3D             : https://www.shadertoy.com/view/4sfGzS
                 * ~     Gradient Noise 2D             : https://www.shadertoy.com/view/XdXGW8
                 * ~     Gradient Noise 3D             : https://www.shadertoy.com/view/Xsl3Dl
                 * ~     Simplex  Noise 2D             : https://www.shadertoy.com/view/Msf3WH
                 * ~     Voronoise: https://www.shadertoy.com/view/Xd23Dh
                 * ~
                 *
                 */

                vec3 random3(vec3 c) {
                    float j = 4096.0*sin(dot(c,vec3(17.0, 59.4, 15.0)));
                    vec3 r;
                    r.z = fract(512.0*j);
                    j *= .125;
                    r.x = fract(512.0*j);
                    j *= .125;
                    r.y = fract(512.0*j);
                    return r-0.5;
                }

                /* skew constants for 3d simplex functions */
                const float F3 =  0.3333333;
                const float G3 =  0.1666667;

                /* 3d simplex noise */
                float simplex3d(vec3 p) {
                     /* 1. find current tetrahedron T and it's four vertices */
                     /* s, s+i1, s+i2, s+1.0 - absolute skewed (integer) coordinates of T vertices */
                     /* x, x1, x2, x3 - unskewed coordinates of p relative to each of T vertices*/

                     /* calculate s and x */
                     vec3 s = floor(p + dot(p, vec3(F3)));
                     vec3 x = p - s + dot(s, vec3(G3));

                     /* calculate i1 and i2 */
                     vec3 e = step(vec3(0.0), x - x.yzx);
                     vec3 i1 = e*(1.0 - e.zxy);
                     vec3 i2 = 1.0 - e.zxy*(1.0 - e);

                     /* x1, x2, x3 */
                     vec3 x1 = x - i1 + G3;
                     vec3 x2 = x - i2 + 2.0*G3;
                     vec3 x3 = x - 1.0 + 3.0*G3;

                     /* 2. find four surflets and store them in d */
                     vec4 w, d;

                     /* calculate surflet weights */
                     w.x = dot(x, x);
                     w.y = dot(x1, x1);
                     w.z = dot(x2, x2);
                     w.w = dot(x3, x3);

                     /* w fades from 0.6 at the center of the surflet to 0.0 at the margin */
                     w = max(0.6 - w, 0.0);

                     /* calculate surflet components */
                     d.x = dot(random3(s), x);
                     d.y = dot(random3(s + i1), x1);
                     d.z = dot(random3(s + i2), x2);
                     d.w = dot(random3(s + 1.0), x3);

                     /* multiply d by w^4 */
                     w *= w;
                     w *= w;
                     d *= w;

                     /* 3. return the sum of the four surflets */
                     return dot(d, vec4(52.0));
                }

                /* const matrices for 3d rotation */
                const mat3 rot1 = mat3(-0.37, 0.36, 0.85,-0.14,-0.93, 0.34,0.92, 0.01,0.4);
                const mat3 rot2 = mat3(-0.55,-0.39, 0.74, 0.33,-0.91,-0.24,0.77, 0.12,0.63);
                const mat3 rot3 = mat3(-0.71, 0.52,-0.47,-0.08,-0.72,-0.68,-0.7,-0.45,0.56);

                /* directional artifacts can be reduced by rotating each octave */
                float simplex3d_fractal(vec3 m) {
                    float noise = 0.5333333*simplex3d(m*rot1)
                            +0.2666667*simplex3d(2.0*m*rot2)
                            +0.1333333*simplex3d(4.0*m*rot3)
                            +0.0666667*simplex3d(8.0*m);

                    return 0.5 + 0.5 * noise; // 0 -> 1

                }

                vec3 grad(vec3 pt, float size) {
                    float right = simplex3d_fractal(vec3(pt.x + size, pt.y, pt.z));
                    float left = simplex3d_fractal(vec3(pt.x - size, pt.y, pt.z));
                    float up = simplex3d_fractal(vec3(pt.x, pt.y + size, pt.z));
                    float down = simplex3d_fractal(vec3(pt.x, pt.y - size, pt.z));
                    float front = simplex3d_fractal(vec3(pt.x, pt.y, pt.z + size));
                    float back = simplex3d_fractal(vec3(pt.x, pt.y, pt.z - size));

                    return vec3(0.5 * (right - left), 0.5 * up - down, 0.5 * front - back);
                }

                const int MAX_STEPS = 20;

                uniform float stepsize;

                uniform vec2 xBounds;
                uniform vec2 yBounds;
                uniform vec2 zBounds;

                uniform vec3 cameraPos;

                float sdf(vec3 sample_point) {
                    float x = sample_point.x;
                    float y = sample_point.y;
                    float z = sample_point.z;

                    float yUpper = (yBounds.y - yBounds.x) * 0.8 + yBounds.x;

                    vec3 p = vec3(sample_point.x, yUpper, sample_point.z);

                    float yUpperNoise = simplex3d_fractal(p * 1.0);
                    yUpperNoise = (yUpperNoise - 0.5) * 0.8;

                    yUpper += yUpperNoise;

                    // under the volume
                    if (y <= yBounds.x || x <= xBounds.x || z <= zBounds.x) {
                        return min(
                            min(yBounds.x - y, xBounds.x - x),
                            zBounds.x - z
                        );
                    }

                    if (x > xBounds.y || z > zBounds.y) {
                        return min(x - xBounds.y, z - zBounds.y);
                    }

                    // we are inside the bounding volume

                    float xRange = xBounds.y - xBounds.x;
                    float zRange = zBounds.y - zBounds.x;

                    float distToEdge = min(
                        min(
                            x - xBounds.x,
                            xBounds.y - x
                        ),
                        min(
                            z - zBounds.x,
                            zBounds.y - z
                        )
                    );

                    yUpper = mix(yBounds.x, yUpper, smoothstep(0.0, min(xRange, zRange) * 0.2, distToEdge));

                    // todo: add some noise to the yUpper itself?
                    // over the top of the volume, -or- within the volume
                    return y - yUpper;
                }

                float density(float signedDistance) {
                    return max(-signedDistance, 0.0) * 40.0;
                }

                void main() {
                    vec3 ro = cameraPos;
                    vec3 dir = vPosition - ro;
                    float t_entry = length(dir);
                    vec3 rd = normalize(dir);

                    vec3 lightPosition = cameraPos;
                    float isoval = 0.0;

                    if (t_entry < 0.) { gl_FragColor = vec4(0.,0.,0.,1.); return; }

                    vec3 rskip = rd * stepsize;

                    // Start at the far end and work our way back to the entry point
                    // (back compositing)
                    // vec3 sample_point = ro + rd * (t_entry + float(MAX_STEPS) * stepsize);
                    vec3 sample_point = ro + rd * t_entry;

                    // xyz = scattering, a = transmission
                    vec4 result = vec4(0.0, 0.0, 0.0, 1.0);


                    for (int i = 0; i < MAX_STEPS; i++) {
                        if (
                            sample_point.x >= xBounds.x && sample_point.x <= xBounds.y &&
                            sample_point.y >= yBounds.x && sample_point.y <= yBounds.y &&
                            sample_point.z >= zBounds.x && sample_point.z <= zBounds.y
                        ) {

                            float sd = sdf(sample_point);

                            if (sd < 0.0) {
                                float extinction = density(sd);

                                vec3 p = sample_point / 10.0 + 0.5;
                                p.y -= 0.30 * t;
                                p.x += 0.3 * t;
                                p.z += 0.3 * t;
                                float noise = simplex3d_fractal(p * 8.0);

                                extinction *= noise;

                                float transmittance = exp(-extinction * stepsize);

                                vec3 luminance = vec3(noise);

                                vec3 integrateScattering = luminance - luminance * transmittance;

                                result.rgb += integrateScattering * result.a;

                                result.a *= transmittance;

                                if (result.a < 0.003) {
                                    result.a = 0.0;
                                    break;
                                }

                                // noise *= stepsize;
                                // noise in  0-1 range (?)

                                // vec3 grad = grad(sample_point, stepsize);
                            }
                        }

                        sample_point += rskip;
                    }

                    // noise_sum = min(1.0, noise_sum);

                    gl_FragColor = vec4(result.rgb, 1.0 - result.a);

                    // vec3 domainSize = vec3(
                    //     xBounds.y - xBounds.x,
                    //     yBounds.y - yBounds.x,
                    //     zBounds.y - zBounds.x
                    // );

                    // vec3 pointPercent = vec3(
                    //     (vPosition.x - xBounds.x) / domainSize.x,
                    //     (vPosition.y - yBounds.x) / domainSize.y,
                    //     (vPosition.z - zBounds.x) / domainSize.z
                    // );

                    // gl_FragColor = vec4(pointPercent, 1.0);
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

    setCameraPosition(c) {
        this.group.children[0].material.uniforms.cameraPos.value.x = c.x;
        this.group.children[0].material.uniforms.cameraPos.value.y = c.y;
        this.group.children[0].material.uniforms.cameraPos.value.z = c.z;
    }
}
