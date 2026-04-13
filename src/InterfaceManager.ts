import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

type AppState = 'IDLE' | 'SLICING' | 'DRAGGING';

export class InterfaceManager{
    private state: AppState = 'IDLE';
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private startPoint = new THREE.Vector3();
    private selectedObject: THREE.Object3D | null = null;
    private dragPlane = new THREE.Plane();
    private dragOffset = new THREE.Vector3();

    constructor(
        private camera: THREE.PerspectiveCamera,
        private controls: OrbitControls,
        private modelRoot: THREE.Group,
        private sliceLine: HTMLElement,
        //get the onSlice fucntion 
        private onSlice: (normal: THREE.Vector3, constant: number) => void
    ) 
    {
        this.initEvents();
    }

    private initEvents() {
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
    }

    //return the intersection point from a raycaster and an infinitley large plane centered at (0,0,0)
    private getIntersectionPoint(e: MouseEvent): THREE.Vector3 {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const cameraDir = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDir);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, new THREE.Vector3());
        const target = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, target);
        return target;
    }

    //Update the SVG to show the dotted lines
    private updateLineUI(x1: number, y1: number, x2: number, y2: number, show: boolean) {
        this.sliceLine.setAttribute('x1', x1.toString());
        this.sliceLine.setAttribute('y1', y1.toString());
        this.sliceLine.setAttribute('x2', x2.toString());
        this.sliceLine.setAttribute('y2', y2.toString());
        this.sliceLine.style.display = show ? 'block' : 'none';
    }

    private onMouseDown(e:MouseEvent){
        //(Ctrl + Click to slice the model)
        if (e.ctrlKey) {
            this.state = 'SLICING';
            this.controls.enabled = false;
            this.startPoint.copy(this.getIntersectionPoint(e));
            this.updateLineUI(e.clientX, e.clientY, e.clientX, e.clientY, true);
        } 

        //(Alt + Click to Drag the model)
        else if (e.altKey) {
            // Drag Logic
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.modelRoot.children, true);

            if (intersects.length > 0) {
                this.state = 'DRAGGING';
                let target = intersects[0].object;
                while (target.parent && target.parent !== this.modelRoot) target = target.parent!;
                this.selectedObject = target;
                this.controls.enabled = false;

                const cameraDir = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDir);
                this.dragPlane.setFromNormalAndCoplanarPoint(cameraDir, intersects[0].point);
                //mantain a dragoffset to prevent teleporting
                this.dragOffset.copy(intersects[0].point).sub(this.selectedObject.position);
            }
        }
    }

    private onMouseMove(e:MouseEvent){
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        if (this.state === 'SLICING') {
            const x1 = parseFloat(this.sliceLine.getAttribute('x1')!);
            const y1 = parseFloat(this.sliceLine.getAttribute('y1')!);
            this.updateLineUI(x1, y1, e.clientX, e.clientY, true);
        } 
        else if (this.state === 'DRAGGING' && this.selectedObject) {
            const point = new THREE.Vector3();
            this.raycaster.setFromCamera(this.mouse, this.camera); // update mouse first
            if (this.raycaster.ray.intersectPlane(this.dragPlane, point)) {
                //update the selected objects poisition based on the drag offset
                this.selectedObject.position.copy(point.sub(this.dragOffset));
            }
        }
    }

    private onMouseUp(e:MouseEvent){
        if (this.state === 'SLICING') {
            const endPoint = this.getIntersectionPoint(e);
            //Slice only when the slice distance is not too tiny
            if (this.startPoint.distanceTo(endPoint) > 0.1) {
                const swipeDir = new THREE.Vector3().subVectors(endPoint, this.startPoint).normalize();
                const cameraDir = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDir);

                const planeNormal = new THREE.Vector3().crossVectors(swipeDir, cameraDir).normalize();
                const midPoint = new THREE.Vector3().addVectors(this.startPoint, endPoint).multiplyScalar(0.5);
                //[n.r + d = 0] where [d = -n.p] and 'd' is the plane constant
                const planeConstant = -planeNormal.dot(midPoint);
                
                //Slice the model
                this.onSlice(planeNormal, planeConstant);
            }
        }
        this.state = 'IDLE';
        this.selectedObject = null;
        this.controls.enabled = true;
        this.updateLineUI(0, 0, 0, 0, false);
    }
}