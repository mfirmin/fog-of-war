
import {
    Euler,
    FloatType,
    Matrix4,
    NearestFilter,
    OrthographicCamera,
    PerspectiveCamera,
    RGBAFormat,
    Scene,
    Vector3,
    WebGLRenderer,
    WebGLRenderTarget,
} from './lib/three.module';

export class Renderer {
    constructor(width, height) {
        try {
            this.renderer = new WebGLRenderer({
                antialias: true,
                alpha: true,
            });
        } catch (e) {
            throw new Error('Could not initialize WebGL');
        }

        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setSize(width, height);
        this.renderer.context.getExtension('EXT_frag_depth_extension');

        this.width = width;
        this.height = height;

        this.entities = [];

        this.scene = new Scene();

        this.lightsource = [-20, 20, 0];

        this.createCamera();
        this.createShadowmap();
    }

    createCamera() {
        const fov = 45;
        const aspect = this.width / this.height;

        this.camera = new PerspectiveCamera(fov, aspect, 0.01, 500.0);

        const pos = new Vector3(0, 10, 0);
        const rot = new Matrix4().makeRotationFromEuler(
            new Euler(0.0, 0, 0, 'ZYX'),
        );

        const newPos = pos.applyMatrix4(rot);


        this.camera.position.x = newPos.x;
        this.camera.position.y = newPos.y;
        this.camera.position.z = newPos.z;
        this.camera.lookAt(0, 0, 0);
        // this.camera.up.set(0, 0, 0);

        const R = 20;
        const T = 20;

        this.lightCamera = new OrthographicCamera(-R, R, T, -T, -1, 500.0);

        this.lightCamera.position.x = this.lightsource[0];
        this.lightCamera.position.y = this.lightsource[1];
        this.lightCamera.position.z = this.lightsource[2];
        this.lightCamera.lookAt(0, 0, 0);
    }

    createShadowmap() {
        this.shadowmap = new WebGLRenderTarget(2048, 2048, {
            magFilter: NearestFilter,
            minFilter: NearestFilter,
            format: RGBAFormat,
            type: FloatType,
        });
    }

    add(entity) {
        entity.setLight(this.lightsource);

        this.entities.push(entity);
        this.scene.add(entity.group);
    }

    addRaw(entity) {
        this.scene.add(entity);
    }

    setSize(width, height) {
        this.width = width;
        this.height = height;

        this.renderer.setSize(width, height);
    }

    setLight(x, y, z) {
        this.lightsource = [x, y, z];
        for (const entity of this.entities) {
            entity.setLight(this.lightsource);
        }
    }

    renderShadowmap() {
        const depthViewMatrix = this.lightCamera.matrixWorldInverse;
        const depthProjectionMatrix = this.lightCamera.projectionMatrix;

        for (const entity of this.entities) {
            entity.setShadowMode();
        }

        this.renderer.setClearColor(0xffffff, 1.0);

        this.renderer.render(this.scene, this.lightCamera, this.shadowmap);

        this.renderer.setClearColor(0x000000, 0.0);

        const depthMatrix = new Matrix4()
            .multiply(depthProjectionMatrix)
            .multiply(depthViewMatrix);

        for (const entity of this.entities) {
            entity.setNormalMode(this.shadowmap, depthMatrix);
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    get element() {
        return this.renderer.domElement;
    }

    intersectPlane(x, y) {
        const vec = new Vector3(
            (x / this.renderer.domElement.width) * 2 - 1,
            -(y / this.renderer.domElement.height) * 2 + 1,
            0.5,
        );

        vec.unproject(this.camera);

        const dir = vec.sub(this.camera.position).normalize();

        const o = new Vector3().copy(this.camera.position);

        const p = new Vector3(0, 0, 0);
        const n = new Vector3(0, 1, 0);

        const q = new Vector3().addVectors(
            o,
            dir.multiplyScalar((new Vector3().copy(p).sub(o)).dot(n) / dir.dot(n)),
        );

        return q;
    }
}
