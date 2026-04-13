import * as THREE from 'three';

interface VertexData {
    position: THREE.Vector3,
    normal: THREE.Vector3 | null,
    uv: THREE.Vector2 | null
}

export class MeshCutter {

    //if 'p' is a point on the plane and 'n' is its normal 
    //then for any point 'r' on the plane.... the plane equation can be expressed as
    // n.dot(r - p) = 0
    // n.r - n.p = [n.r + d]    '.' is the dot product
    //where 'd' is the planeConstant with the value (-n.p);
    //use this to classify that if we have the plane normal and the constant
    //where 'p' is a point on the plane and 'n' is the plane normal and 'r' will be any point on the model
    // [n.r + d] > 0 or <0 then 'r' is inside or outside the plane
    // [n.r + d] == 0 then 'r' lies on the plane
    private static classifyPoint(point: THREE.Vector3, planeNormal: THREE.Vector3, planeConstant: number) {
        //[n.r + d]
        return planeNormal.dot(point) + planeConstant;
    }

    //Linearly Interpolate between two vertices based on 't'
    //where 't' is the interpolation factor
    private static lerpVertex(vA: VertexData, vB: VertexData, t: number): VertexData {
        return {
            position: new THREE.Vector3().lerpVectors(vA.position, vB.position, t),
            //Normals and UV might not exists for the model
            normal: vA.normal && vB.normal
                ? new THREE.Vector3().lerpVectors(vA.normal, vB.normal, t).normalize()
                : null,
            uv: vA.uv && vB.uv
                ? new THREE.Vector2().lerpVectors(vA.uv, vB.uv, t)
                : null
        };
    }

    //Get the position,normal and uv info from the Buffer Geometry of the model
    private static getVertex(geometry: THREE.BufferGeometry, index: number): VertexData {
        const pos = geometry.attributes.position;
        const nor = geometry.attributes.normal;
        const uvs = geometry.attributes.uv;

        return {
            position: new THREE.Vector3(pos.getX(index), pos.getY(index), pos.getZ(index)),
            normal: nor ? new THREE.Vector3(nor.getX(index), nor.getY(index), nor.getZ(index)) : null,
            uv: uvs ? new THREE.Vector2(uvs.getX(index), uvs.getY(index)) : null
        };
    }

    private static clipTriangle(v0: VertexData, v1: VertexData, v2: VertexData, planeNormal: THREE.Vector3, planeConstant: number, topVerts: VertexData[], bottomVerts: VertexData[]) {

        //get the [n.r + d] values based on 'r' being vertex point on the triangle v0,v1,v2
        const dists = [
            this.classifyPoint(v0.position, planeNormal, planeConstant),
            this.classifyPoint(v1.position, planeNormal, planeConstant),
            this.classifyPoint(v2.position, planeNormal, planeConstant)
        ];

        const verts = [v0, v1, v2];
        const top: VertexData[] = [];
        const bottom: VertexData[] = [];

        //loop through the three vertices of the triangle
        for (let i = 0; i < 3; i++) {
            //we will check the three edges of the triangle in order
            //v0->v1 v1->v2 v2->v0
            const j = (i + 1) % 3;
            const vA = verts[i], dA = dists[i];
            const vB = verts[j], dB = dists[j];

            //check if the [n.r + d] is >0 or <0 and push it either into top or bottom array
            if (dA >= 0) top.push(vA);
            else bottom.push(vA);

            //check if the edge crosses the plane
            if ((dA > 0 && dB < 0) || (dA < 0 && dB > 0)) {
                //the intersection factor can be derived based on the 
                //if edge AB is cut by a plane at point I
                //[LINEAR INTERPOLATION FORMULA]
                //then I = vA + t(vB-vA) where 't' is some interpolation factor and  vA and vB are vertex points of the edge AB
                //so if I is the intersection point then i lies on the plane and as before
                //we can do [(n.I) + d  = 0]
                //Solving fo I we get 't' the interpolation factor as 
                const t = dA / (dA - dB);
                //where dA = [n.vA + d] and dB = [n.vB + d]..which we get from the dists array
                const intersection = this.lerpVertex(vA, vB, t);
                top.push(intersection);
                bottom.push(intersection);
            }
        }

        //polygonize the vertex data[Triangle Fan]
        //using the first vertex at index 0 as the anchor point
        const triangulate = (poly: VertexData[], output: VertexData[]) => {
            for (let i = 1; i + 1 < poly.length; i++) {
                output.push(poly[0], poly[i], poly[i + 1]);
            }
        };

        //only polygonize when possible
        if (top.length >= 3) triangulate(top, topVerts);
        if (bottom.length >= 3) triangulate(bottom, bottomVerts);
    }

    //build a buffer geometry with position normals and uvs
    private static buildBuffer(vertices: VertexData[]): THREE.BufferGeometry | null {
        if (vertices.length === 0) return null;

        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];

        vertices.forEach(v => {
            positions.push(v.position.x, v.position.y, v.position.z);
            if (v.normal) normals.push(v.normal.x, v.normal.y, v.normal.z);
            if (v.uv) uvs.push(v.uv.x, v.uv.y);
        });

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        if (normals.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        if (uvs.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        return geo;
    }

    //Slice a given geomtry based on ervything defined above
    static sliceGeometry(geometry: THREE.BufferGeometry, planeNormal: THREE.Vector3, planeConstant: number) {
        //convert geometry to non index based to allow for simpler three triangles
        //without taking into account the common vertices
        const geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        if (!geo.attributes.normal) geo.computeVertexNormals();

        const pos = geo.attributes.position;
        const triangleCount = pos.count / 3;//the three vertex points make up the triangle

        const topVerts: VertexData[] = [];
        const bottomVerts: VertexData[] = [];

        //Loop throuh all the triangles
        //v0 v1 v2 are the three vertices of the triangles
        for (let t = 0; t < triangleCount; t++) {
            this.clipTriangle(
                this.getVertex(geo, t * 3),//v0
                this.getVertex(geo, t * 3 + 1),//v1
                this.getVertex(geo, t * 3 + 2),//v2
                planeNormal, planeConstant, topVerts, bottomVerts
            );
        }

        //build the top and bottom half of the geometry
        return {
            top: this.buildBuffer(topVerts),
            bottom: this.buildBuffer(bottomVerts)
        };
    }

}