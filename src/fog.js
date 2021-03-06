
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

export class Fog {
    constructor(width, height, yOffset) {
        const hWidth = 0.5 * width;
        const hHeight = 0.5 * height;

        const vbuffer = new Float32Array([
            -hWidth, 0.0, hHeight,
            hWidth, 0.0, hHeight,
            hWidth, 0.0, -hHeight,

            -hWidth, 0.0, hHeight,
            hWidth, 0.0, -hHeight,
            -hWidth, 0.0, -hHeight,
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
                    return   0.5333333*simplex3d(m*rot1)
                            +0.2666667*simplex3d(2.0*m*rot2)
                            +0.1333333*simplex3d(4.0*m*rot3)
                            +0.0666667*simplex3d(8.0*m);
                }

                void main() {
                    vec3 L = normalize(lightsource);
                    vec2 p = vPosition.xz / 10.0 + 0.5 + 0.02 * t;
                    float noise = simplex3d_fractal(vec3(p * 8.0, t * 1.0));

                    noise = 0.5 + 0.5 * noise;

                    float alpha = pow(noise, 0.01);
                    alpha = 1.0;

                    float reveal = length(vPosition - revealPoint);

                    if (reveal < 1.0) {
                        alpha *= smoothstep(0.8, 1.0, reveal);
                    }

                    float dpx = dFdx(vPosition.x);
                    float dpy = dFdy(vPosition.z);

                    // float dNoiseX = dFdx(pow(noise, 0.1));
                    // float dNoiseY = dFdy(pow(noise, 0.1));
                    float dNoiseX = dFdx(pow(noise, 0.01));
                    float dNoiseY = dFdy(pow(noise, 0.01));

                    vec3 tangentX = normalize(vec3(dpx, dNoiseX, 0.0));
                    vec3 tangentY = normalize(vec3(0.0, dNoiseY, dpy));

                    vec3 N = normalize(cross(tangentX, tangentY));

                    vec3 color = vec3(1.0);

                    color *= dot(normalize(lightsource), N) * pow(noise, 0.5) * 1.5;

                    // color.r = N.x;
                    // color.g = N.y;
                    // color.b = N.z;

                    // color *= noise;

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
