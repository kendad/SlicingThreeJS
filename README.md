# Slicing ThreeJS
A mesh slicing application written in ThreeJS

A Slicing Algorithm based on the __Sutherland-Hodgman algorithm__ adapted to the project need of slicing models.

Basic permise of the algorithm is that a plane can cut a triangle and we can decide if three
vertex points of the traingle lies above or below or on the triangle and based on that seperate the model into Top and Bottom halves. Full Implementation and derivation details can
be check out in the commented code at __MeshCutter.ts__
___

External Libraries Used: THREEJS
Supports currenly only GLTF/GLB models
___

# Limitations

* Caps are not generated[Incomplete][would add with more time]

* It loops through all the model and its children in the scene when slicing. For extremly highly detailed mesh will slow the cutting process. Solution would be to use somehting like bounding volumes to limit our search of the children within the search area or use an already implemented external three library like *three-bvh-csg*

* The slicing is done on a mathematical represenation of an infinite plane in slice direction due to which any mesh in the way on this infinite plane get cuts.

```
git clone https://github.com/kendad/SlicingThreeJS.git

cd SlicingThreeJS

npm install

npm run dev
```
