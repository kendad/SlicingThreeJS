import * as THREE from 'three';
import { MeshCutter } from './MeshCutter';

export class CutManager {
    //the root model group
    private modelRoot: THREE.Group;

    constructor(model:THREE.Group){
        this.modelRoot = model;
    }

    //Crate a mesh from the buffer geometry
    private addSlicedMesh(geo: THREE.BufferGeometry, original: THREE.Mesh, group: THREE.Group) {
        const mesh = new THREE.Mesh(geo, (original.material as THREE.Material).clone());
        mesh.applyMatrix4(original.matrixWorld);//apply the model materix to this new mesh
        group.add(mesh);
    }

    //Traverse through the model and slice it into either above or below the plane
    private sliceModel(model: THREE.Object3D, planeNormal: THREE.Vector3, planeConstant: number) {
        const topGroup = new THREE.Group();
        const bottomGroup = new THREE.Group();

        model.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;

            //get the inverse of the models modelMatrix
            const worldToLocal = child.matrixWorld.clone().invert();
            //use that inverse modelMatrix to bring the normal to the models local space
            const localNormal = planeNormal.clone().transformDirection(worldToLocal).normalize();
            //determine a pooint on the plane
            const pointOnWorldPlane = planeNormal.clone().multiplyScalar(-planeConstant);
            
            //convert the point on plane to the models local space
            const pointInLocalSpace = pointOnWorldPlane.applyMatrix4(worldToLocal);

            //get the 'd' is the planeConstant from the plane equation
            //[n.r + d] where d = -n.p .... check comments on MeshCutter.ts for derivation
            const localConstant = -localNormal.dot(pointInLocalSpace);

            //Once we have the planeNormal and constant
            //slice it into top and bottom halves
            const { top, bottom } = MeshCutter.sliceGeometry(child.geometry, localNormal, localConstant);

            //create a mesh for the sliced geometries
            if (top) this.addSlicedMesh(top, child, topGroup);
            if (bottom) this.addSlicedMesh(bottom, child, bottomGroup);
        });

        return { topGroup, bottomGroup };
    }

    //Excute the slciing logic
    executeCut(planeNormal: THREE.Vector3, planeConstant: number) {
        const targets = [...this.modelRoot.children];

        targets.forEach((child) => {
            const { topGroup, bottomGroup } = this.sliceModel(child as THREE.Object3D, planeNormal, planeConstant);

            //remove the base model and update it with its sliced counterparts
            if (topGroup.children.length > 0 && bottomGroup.children.length > 0) {
                this.modelRoot.remove(child);
                
                //slighly offset the model along the planeNormal
                //just to show that there has been some slicing
                topGroup.position.addScaledVector(planeNormal, 0.1);
                bottomGroup.position.addScaledVector(planeNormal, -0.1);

                //add it to the core group for displaying in the scene
                this.modelRoot.add(topGroup);
                this.modelRoot.add(bottomGroup);
            }
        });
    }
}