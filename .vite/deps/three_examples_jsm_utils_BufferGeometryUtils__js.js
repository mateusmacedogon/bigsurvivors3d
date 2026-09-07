import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  TriangleFanDrawMode,
  TriangleStripDrawMode,
  TrianglesDrawMode,
  Vector3
} from "./chunk-A4AJ4SZV.js";
import "./chunk-BUSYA2B4.js";

// node_modules/three/examples/jsm/utils/BufferGeometryUtils.js
function computeMikkTSpaceTangents(geometry, MikkTSpace, negateSign = true) {
  if (!MikkTSpace || !MikkTSpace.isReady) {
    throw new Error("THREE.BufferGeometryUtils: Initialized MikkTSpace library required.");
  }
  if (!geometry.hasAttribute("position") || !geometry.hasAttribute("normal") || !geometry.hasAttribute("uv")) {
    throw new Error('THREE.BufferGeometryUtils: Tangents require "position", "normal", and "uv" attributes.');
  }
  function getAttributeArray(attribute) {
    if (attribute.normalized || attribute.isInterleavedBufferAttribute) {
      const dstArray = new Float32Array(attribute.count * attribute.itemSize);
      for (let i = 0, j = 0; i < attribute.count; i++) {
        dstArray[j++] = attribute.getX(i);
        dstArray[j++] = attribute.getY(i);
        if (attribute.itemSize > 2) {
          dstArray[j++] = attribute.getZ(i);
        }
      }
      return dstArray;
    }
    if (attribute.array instanceof Float32Array) {
      return attribute.array;
    }
    return new Float32Array(attribute.array);
  }
  const _geometry = geometry.index ? geometry.toNonIndexed() : geometry;
  const tangents = MikkTSpace.generateTangents(
    getAttributeArray(_geometry.attributes.position),
    getAttributeArray(_geometry.attributes.normal),
    getAttributeArray(_geometry.attributes.uv)
  );
  if (negateSign) {
    for (let i = 3; i < tangents.length; i += 4) {
      tangents[i] *= -1;
    }
  }
  _geometry.setAttribute("tangent", new BufferAttribute(tangents, 4));
  if (geometry !== _geometry) {
    geometry.copy(_geometry);
  }
  return geometry;
}
function mergeGeometries(geometries, useGroups = false) {
  const isIndexed = geometries[0].index !== null;
  const attributesUsed = new Set(Object.keys(geometries[0].attributes));
  const morphAttributesUsed = new Set(Object.keys(geometries[0].morphAttributes));
  const attributes = {};
  const morphAttributes = {};
  const morphTargetsRelative = geometries[0].morphTargetsRelative;
  const mergedGeometry = new BufferGeometry();
  let offset = 0;
  for (let i = 0; i < geometries.length; ++i) {
    const geometry = geometries[i];
    let attributesCount = 0;
    if (isIndexed !== (geometry.index !== null)) {
      console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.");
      return null;
    }
    for (const name in geometry.attributes) {
      if (!attributesUsed.has(name)) {
        console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + '. All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.');
        return null;
      }
      if (attributes[name] === void 0) attributes[name] = [];
      attributes[name].push(geometry.attributes[name]);
      attributesCount++;
    }
    if (attributesCount !== attributesUsed.size) {
      console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ". Make sure all geometries have the same number of attributes.");
      return null;
    }
    if (morphTargetsRelative !== geometry.morphTargetsRelative) {
      console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ". .morphTargetsRelative must be consistent throughout all geometries.");
      return null;
    }
    for (const name in geometry.morphAttributes) {
      if (!morphAttributesUsed.has(name)) {
        console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ".  .morphAttributes must be consistent throughout all geometries.");
        return null;
      }
      if (morphAttributes[name] === void 0) morphAttributes[name] = [];
      morphAttributes[name].push(geometry.morphAttributes[name]);
    }
    if (useGroups) {
      let count;
      if (isIndexed) {
        count = geometry.index.count;
      } else if (geometry.attributes.position !== void 0) {
        count = geometry.attributes.position.count;
      } else {
        console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ". The geometry must have either an index or a position attribute");
        return null;
      }
      mergedGeometry.addGroup(offset, count, i);
      offset += count;
    }
  }
  if (isIndexed) {
    let indexOffset = 0;
    const mergedIndex = [];
    for (let i = 0; i < geometries.length; ++i) {
      const index = geometries[i].index;
      for (let j = 0; j < index.count; ++j) {
        mergedIndex.push(index.getX(j) + indexOffset);
      }
      indexOffset += geometries[i].attributes.position.count;
    }
    mergedGeometry.setIndex(mergedIndex);
  }
  for (const name in attributes) {
    const mergedAttribute = mergeAttributes(attributes[name]);
    if (!mergedAttribute) {
      console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + name + " attribute.");
      return null;
    }
    mergedGeometry.setAttribute(name, mergedAttribute);
  }
  for (const name in morphAttributes) {
    const numMorphTargets = morphAttributes[name][0].length;
    if (numMorphTargets === 0) continue;
    mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
    mergedGeometry.morphAttributes[name] = [];
    for (let i = 0; i < numMorphTargets; ++i) {
      const morphAttributesToMerge = [];
      for (let j = 0; j < morphAttributes[name].length; ++j) {
        morphAttributesToMerge.push(morphAttributes[name][j][i]);
      }
      const mergedMorphAttribute = mergeAttributes(morphAttributesToMerge);
      if (!mergedMorphAttribute) {
        console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + name + " morphAttribute.");
        return null;
      }
      mergedGeometry.morphAttributes[name].push(mergedMorphAttribute);
    }
  }
  return mergedGeometry;
}
function mergeAttributes(attributes) {
  let TypedArray;
  let itemSize;
  let normalized;
  let gpuType = -1;
  let arrayLength = 0;
  for (let i = 0; i < attributes.length; ++i) {
    const attribute = attributes[i];
    if (TypedArray === void 0) TypedArray = attribute.array.constructor;
    if (TypedArray !== attribute.array.constructor) {
      console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.");
      return null;
    }
    if (itemSize === void 0) itemSize = attribute.itemSize;
    if (itemSize !== attribute.itemSize) {
      console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.");
      return null;
    }
    if (normalized === void 0) normalized = attribute.normalized;
    if (normalized !== attribute.normalized) {
      console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.");
      return null;
    }
    if (gpuType === -1) gpuType = attribute.gpuType;
    if (gpuType !== attribute.gpuType) {
      console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.");
      return null;
    }
    arrayLength += attribute.count * itemSize;
  }
  const array = new TypedArray(arrayLength);
  const result = new BufferAttribute(array, itemSize, normalized);
  let offset = 0;
  for (let i = 0; i < attributes.length; ++i) {
    const attribute = attributes[i];
    if (attribute.isInterleavedBufferAttribute) {
      const tupleOffset = offset / itemSize;
      for (let j = 0, l = attribute.count; j < l; j++) {
        for (let c = 0; c < itemSize; c++) {
          const value = attribute.getComponent(j, c);
          result.setComponent(j + tupleOffset, c, value);
        }
      }
    } else {
      array.set(attribute.array, offset);
    }
    offset += attribute.count * itemSize;
  }
  if (gpuType !== void 0) {
    result.gpuType = gpuType;
  }
  return result;
}
function deepCloneAttribute(attribute) {
  if (attribute.isInstancedInterleavedBufferAttribute || attribute.isInterleavedBufferAttribute) {
    return deinterleaveAttribute(attribute);
  }
  if (attribute.isInstancedBufferAttribute) {
    return new InstancedBufferAttribute().copy(attribute);
  }
  return new BufferAttribute().copy(attribute);
}
function interleaveAttributes(attributes) {
  let TypedArray;
  let arrayLength = 0;
  let stride = 0;
  for (let i = 0, l = attributes.length; i < l; ++i) {
    const attribute = attributes[i];
    if (TypedArray === void 0) TypedArray = attribute.array.constructor;
    if (TypedArray !== attribute.array.constructor) {
      console.error("AttributeBuffers of different types cannot be interleaved");
      return null;
    }
    arrayLength += attribute.array.length;
    stride += attribute.itemSize;
  }
  const interleavedBuffer = new InterleavedBuffer(new TypedArray(arrayLength), stride);
  let offset = 0;
  const res = [];
  const getters = ["getX", "getY", "getZ", "getW"];
  const setters = ["setX", "setY", "setZ", "setW"];
  for (let j = 0, l = attributes.length; j < l; j++) {
    const attribute = attributes[j];
    const itemSize = attribute.itemSize;
    const count = attribute.count;
    const iba = new InterleavedBufferAttribute(interleavedBuffer, itemSize, offset, attribute.normalized);
    res.push(iba);
    offset += itemSize;
    for (let c = 0; c < count; c++) {
      for (let k = 0; k < itemSize; k++) {
        iba[setters[k]](c, attribute[getters[k]](c));
      }
    }
  }
  return res;
}
function deinterleaveAttribute(attribute) {
  const cons = attribute.data.array.constructor;
  const count = attribute.count;
  const itemSize = attribute.itemSize;
  const normalized = attribute.normalized;
  const array = new cons(count * itemSize);
  let newAttribute;
  if (attribute.isInstancedInterleavedBufferAttribute) {
    newAttribute = new InstancedBufferAttribute(array, itemSize, normalized, attribute.meshPerAttribute);
  } else {
    newAttribute = new BufferAttribute(array, itemSize, normalized);
  }
  for (let i = 0; i < count; i++) {
    newAttribute.setX(i, attribute.getX(i));
    if (itemSize >= 2) {
      newAttribute.setY(i, attribute.getY(i));
    }
    if (itemSize >= 3) {
      newAttribute.setZ(i, attribute.getZ(i));
    }
    if (itemSize >= 4) {
      newAttribute.setW(i, attribute.getW(i));
    }
  }
  return newAttribute;
}
function deinterleaveGeometry(geometry) {
  const attributes = geometry.attributes;
  const morphTargets = geometry.morphTargets;
  const attrMap = /* @__PURE__ */ new Map();
  for (const key in attributes) {
    const attr = attributes[key];
    if (attr.isInterleavedBufferAttribute) {
      if (!attrMap.has(attr)) {
        attrMap.set(attr, deinterleaveAttribute(attr));
      }
      attributes[key] = attrMap.get(attr);
    }
  }
  for (const key in morphTargets) {
    const attr = morphTargets[key];
    if (attr.isInterleavedBufferAttribute) {
      if (!attrMap.has(attr)) {
        attrMap.set(attr, deinterleaveAttribute(attr));
      }
      morphTargets[key] = attrMap.get(attr);
    }
  }
}
function estimateBytesUsed(geometry) {
  let mem = 0;
  for (const name in geometry.attributes) {
    const attr = geometry.getAttribute(name);
    mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;
  }
  const indices = geometry.getIndex();
  mem += indices ? indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT : 0;
  return mem;
}
function mergeVertices(geometry, tolerance = 1e-4) {
  tolerance = Math.max(tolerance, Number.EPSILON);
  const hashToIndex = {};
  const indices = geometry.getIndex();
  const positions = geometry.getAttribute("position");
  const vertexCount = indices ? indices.count : positions.count;
  let nextIndex = 0;
  const attributeNames = Object.keys(geometry.attributes);
  const tmpAttributes = {};
  const tmpMorphAttributes = {};
  const newIndices = [];
  const getters = ["getX", "getY", "getZ", "getW"];
  const setters = ["setX", "setY", "setZ", "setW"];
  for (let i = 0, l = attributeNames.length; i < l; i++) {
    const name = attributeNames[i];
    const attr = geometry.attributes[name];
    tmpAttributes[name] = new attr.constructor(
      new attr.array.constructor(attr.count * attr.itemSize),
      attr.itemSize,
      attr.normalized
    );
    const morphAttributes = geometry.morphAttributes[name];
    if (morphAttributes) {
      if (!tmpMorphAttributes[name]) tmpMorphAttributes[name] = [];
      morphAttributes.forEach((morphAttr, i2) => {
        const array = new morphAttr.array.constructor(morphAttr.count * morphAttr.itemSize);
        tmpMorphAttributes[name][i2] = new morphAttr.constructor(array, morphAttr.itemSize, morphAttr.normalized);
      });
    }
  }
  const halfTolerance = tolerance * 0.5;
  const exponent = Math.log10(1 / tolerance);
  const hashMultiplier = Math.pow(10, exponent);
  const hashAdditive = halfTolerance * hashMultiplier;
  for (let i = 0; i < vertexCount; i++) {
    const index = indices ? indices.getX(i) : i;
    let hash = "";
    for (let j = 0, l = attributeNames.length; j < l; j++) {
      const name = attributeNames[j];
      const attribute = geometry.getAttribute(name);
      const itemSize = attribute.itemSize;
      for (let k = 0; k < itemSize; k++) {
        hash += `${~~(attribute[getters[k]](index) * hashMultiplier + hashAdditive)},`;
      }
    }
    if (hash in hashToIndex) {
      newIndices.push(hashToIndex[hash]);
    } else {
      for (let j = 0, l = attributeNames.length; j < l; j++) {
        const name = attributeNames[j];
        const attribute = geometry.getAttribute(name);
        const morphAttributes = geometry.morphAttributes[name];
        const itemSize = attribute.itemSize;
        const newArray = tmpAttributes[name];
        const newMorphArrays = tmpMorphAttributes[name];
        for (let k = 0; k < itemSize; k++) {
          const getterFunc = getters[k];
          const setterFunc = setters[k];
          newArray[setterFunc](nextIndex, attribute[getterFunc](index));
          if (morphAttributes) {
            for (let m = 0, ml = morphAttributes.length; m < ml; m++) {
              newMorphArrays[m][setterFunc](nextIndex, morphAttributes[m][getterFunc](index));
            }
          }
        }
      }
      hashToIndex[hash] = nextIndex;
      newIndices.push(nextIndex);
      nextIndex++;
    }
  }
  const result = geometry.clone();
  for (const name in geometry.attributes) {
    const tmpAttribute = tmpAttributes[name];
    result.setAttribute(name, new tmpAttribute.constructor(
      tmpAttribute.array.slice(0, nextIndex * tmpAttribute.itemSize),
      tmpAttribute.itemSize,
      tmpAttribute.normalized
    ));
    if (!(name in tmpMorphAttributes)) continue;
    for (let j = 0; j < tmpMorphAttributes[name].length; j++) {
      const tmpMorphAttribute = tmpMorphAttributes[name][j];
      result.morphAttributes[name][j] = new tmpMorphAttribute.constructor(
        tmpMorphAttribute.array.slice(0, nextIndex * tmpMorphAttribute.itemSize),
        tmpMorphAttribute.itemSize,
        tmpMorphAttribute.normalized
      );
    }
  }
  result.setIndex(newIndices);
  return result;
}
function toTrianglesDrawMode(geometry, drawMode) {
  if (drawMode === TrianglesDrawMode) {
    console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.");
    return geometry;
  }
  if (drawMode === TriangleFanDrawMode || drawMode === TriangleStripDrawMode) {
    let index = geometry.getIndex();
    if (index === null) {
      const indices = [];
      const position = geometry.getAttribute("position");
      if (position !== void 0) {
        for (let i = 0; i < position.count; i++) {
          indices.push(i);
        }
        geometry.setIndex(indices);
        index = geometry.getIndex();
      } else {
        console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.");
        return geometry;
      }
    }
    const numberOfTriangles = index.count - 2;
    const newIndices = [];
    if (drawMode === TriangleFanDrawMode) {
      for (let i = 1; i <= numberOfTriangles; i++) {
        newIndices.push(index.getX(0));
        newIndices.push(index.getX(i));
        newIndices.push(index.getX(i + 1));
      }
    } else {
      for (let i = 0; i < numberOfTriangles; i++) {
        if (i % 2 === 0) {
          newIndices.push(index.getX(i));
          newIndices.push(index.getX(i + 1));
          newIndices.push(index.getX(i + 2));
        } else {
          newIndices.push(index.getX(i + 2));
          newIndices.push(index.getX(i + 1));
          newIndices.push(index.getX(i));
        }
      }
    }
    if (newIndices.length / 3 !== numberOfTriangles) {
      console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");
    }
    const newGeometry = geometry.clone();
    newGeometry.setIndex(newIndices);
    newGeometry.clearGroups();
    return newGeometry;
  } else {
    console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:", drawMode);
    return geometry;
  }
}
function computeMorphedAttributes(object) {
  const _vA = new Vector3();
  const _vB = new Vector3();
  const _vC = new Vector3();
  const _tempA = new Vector3();
  const _tempB = new Vector3();
  const _tempC = new Vector3();
  const _morphA = new Vector3();
  const _morphB = new Vector3();
  const _morphC = new Vector3();
  function _calculateMorphedAttributeData(object2, attribute, morphAttribute, morphTargetsRelative2, a2, b2, c2, modifiedAttributeArray) {
    _vA.fromBufferAttribute(attribute, a2);
    _vB.fromBufferAttribute(attribute, b2);
    _vC.fromBufferAttribute(attribute, c2);
    const morphInfluences = object2.morphTargetInfluences;
    if (morphAttribute && morphInfluences) {
      _morphA.set(0, 0, 0);
      _morphB.set(0, 0, 0);
      _morphC.set(0, 0, 0);
      for (let i2 = 0, il2 = morphAttribute.length; i2 < il2; i2++) {
        const influence = morphInfluences[i2];
        const morph = morphAttribute[i2];
        if (influence === 0) continue;
        _tempA.fromBufferAttribute(morph, a2);
        _tempB.fromBufferAttribute(morph, b2);
        _tempC.fromBufferAttribute(morph, c2);
        if (morphTargetsRelative2) {
          _morphA.addScaledVector(_tempA, influence);
          _morphB.addScaledVector(_tempB, influence);
          _morphC.addScaledVector(_tempC, influence);
        } else {
          _morphA.addScaledVector(_tempA.sub(_vA), influence);
          _morphB.addScaledVector(_tempB.sub(_vB), influence);
          _morphC.addScaledVector(_tempC.sub(_vC), influence);
        }
      }
      _vA.add(_morphA);
      _vB.add(_morphB);
      _vC.add(_morphC);
    }
    if (object2.isSkinnedMesh) {
      object2.applyBoneTransform(a2, _vA);
      object2.applyBoneTransform(b2, _vB);
      object2.applyBoneTransform(c2, _vC);
    }
    modifiedAttributeArray[a2 * 3 + 0] = _vA.x;
    modifiedAttributeArray[a2 * 3 + 1] = _vA.y;
    modifiedAttributeArray[a2 * 3 + 2] = _vA.z;
    modifiedAttributeArray[b2 * 3 + 0] = _vB.x;
    modifiedAttributeArray[b2 * 3 + 1] = _vB.y;
    modifiedAttributeArray[b2 * 3 + 2] = _vB.z;
    modifiedAttributeArray[c2 * 3 + 0] = _vC.x;
    modifiedAttributeArray[c2 * 3 + 1] = _vC.y;
    modifiedAttributeArray[c2 * 3 + 2] = _vC.z;
  }
  const geometry = object.geometry;
  const material = object.material;
  let a, b, c;
  const index = geometry.index;
  const positionAttribute = geometry.attributes.position;
  const morphPosition = geometry.morphAttributes.position;
  const morphTargetsRelative = geometry.morphTargetsRelative;
  const normalAttribute = geometry.attributes.normal;
  const morphNormal = geometry.morphAttributes.normal;
  const groups = geometry.groups;
  const drawRange = geometry.drawRange;
  let i, j, il, jl;
  let group;
  let start, end;
  const modifiedPosition = new Float32Array(positionAttribute.count * positionAttribute.itemSize);
  const modifiedNormal = new Float32Array(normalAttribute.count * normalAttribute.itemSize);
  if (index !== null) {
    if (Array.isArray(material)) {
      for (i = 0, il = groups.length; i < il; i++) {
        group = groups[i];
        start = Math.max(group.start, drawRange.start);
        end = Math.min(group.start + group.count, drawRange.start + drawRange.count);
        for (j = start, jl = end; j < jl; j += 3) {
          a = index.getX(j);
          b = index.getX(j + 1);
          c = index.getX(j + 2);
          _calculateMorphedAttributeData(
            object,
            positionAttribute,
            morphPosition,
            morphTargetsRelative,
            a,
            b,
            c,
            modifiedPosition
          );
          _calculateMorphedAttributeData(
            object,
            normalAttribute,
            morphNormal,
            morphTargetsRelative,
            a,
            b,
            c,
            modifiedNormal
          );
        }
      }
    } else {
      start = Math.max(0, drawRange.start);
      end = Math.min(index.count, drawRange.start + drawRange.count);
      for (i = start, il = end; i < il; i += 3) {
        a = index.getX(i);
        b = index.getX(i + 1);
        c = index.getX(i + 2);
        _calculateMorphedAttributeData(
          object,
          positionAttribute,
          morphPosition,
          morphTargetsRelative,
          a,
          b,
          c,
          modifiedPosition
        );
        _calculateMorphedAttributeData(
          object,
          normalAttribute,
          morphNormal,
          morphTargetsRelative,
          a,
          b,
          c,
          modifiedNormal
        );
      }
    }
  } else {
    if (Array.isArray(material)) {
      for (i = 0, il = groups.length; i < il; i++) {
        group = groups[i];
        start = Math.max(group.start, drawRange.start);
        end = Math.min(group.start + group.count, drawRange.start + drawRange.count);
        for (j = start, jl = end; j < jl; j += 3) {
          a = j;
          b = j + 1;
          c = j + 2;
          _calculateMorphedAttributeData(
            object,
            positionAttribute,
            morphPosition,
            morphTargetsRelative,
            a,
            b,
            c,
            modifiedPosition
          );
          _calculateMorphedAttributeData(
            object,
            normalAttribute,
            morphNormal,
            morphTargetsRelative,
            a,
            b,
            c,
            modifiedNormal
          );
        }
      }
    } else {
      start = Math.max(0, drawRange.start);
      end = Math.min(positionAttribute.count, drawRange.start + drawRange.count);
      for (i = start, il = end; i < il; i += 3) {
        a = i;
        b = i + 1;
        c = i + 2;
        _calculateMorphedAttributeData(
          object,
          positionAttribute,
          morphPosition,
          morphTargetsRelative,
          a,
          b,
          c,
          modifiedPosition
        );
        _calculateMorphedAttributeData(
          object,
          normalAttribute,
          morphNormal,
          morphTargetsRelative,
          a,
          b,
          c,
          modifiedNormal
        );
      }
    }
  }
  const morphedPositionAttribute = new Float32BufferAttribute(modifiedPosition, 3);
  const morphedNormalAttribute = new Float32BufferAttribute(modifiedNormal, 3);
  return {
    positionAttribute,
    normalAttribute,
    morphedPositionAttribute,
    morphedNormalAttribute
  };
}
function mergeGroups(geometry) {
  if (geometry.groups.length === 0) {
    console.warn("THREE.BufferGeometryUtils.mergeGroups(): No groups are defined. Nothing to merge.");
    return geometry;
  }
  let groups = geometry.groups;
  groups = groups.sort((a, b) => {
    if (a.materialIndex !== b.materialIndex) return a.materialIndex - b.materialIndex;
    return a.start - b.start;
  });
  if (geometry.getIndex() === null) {
    const positionAttribute = geometry.getAttribute("position");
    const indices = [];
    for (let i = 0; i < positionAttribute.count; i += 3) {
      indices.push(i, i + 1, i + 2);
    }
    geometry.setIndex(indices);
  }
  const index = geometry.getIndex();
  const newIndices = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupStart = group.start;
    const groupLength = groupStart + group.count;
    for (let j = groupStart; j < groupLength; j++) {
      newIndices.push(index.getX(j));
    }
  }
  geometry.dispose();
  geometry.setIndex(newIndices);
  let start = 0;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    group.start = start;
    start += group.count;
  }
  let currentGroup = groups[0];
  geometry.groups = [currentGroup];
  for (let i = 1; i < groups.length; i++) {
    const group = groups[i];
    if (currentGroup.materialIndex === group.materialIndex) {
      currentGroup.count += group.count;
    } else {
      currentGroup = group;
      geometry.groups.push(currentGroup);
    }
  }
  return geometry;
}
function toCreasedNormals(geometry, creaseAngle = Math.PI / 3) {
  const resultGeometry = geometry.index ? geometry.toNonIndexed() : geometry;
  const posAttr = resultGeometry.attributes.position;
  const vertexCount = posAttr.count;
  let positions;
  if (posAttr.isBufferAttribute === true && posAttr.itemSize === 3 && posAttr.normalized === false) {
    positions = posAttr.array;
  } else {
    positions = new Float64Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      positions[3 * i + 0] = posAttr.getX(i);
      positions[3 * i + 1] = posAttr.getY(i);
      positions[3 * i + 2] = posAttr.getZ(i);
    }
  }
  const creaseDot = Math.cos(creaseAngle);
  const hashMultiplier = (1 + 1e-10) * 100;
  const faceCount = vertexCount / 3;
  const faceNormals = new Float64Array(faceCount * 3);
  for (let f = 0; f < faceCount; f++) {
    const f9 = 9 * f;
    const ax = positions[f9 + 0], ay = positions[f9 + 1], az = positions[f9 + 2];
    const bx = positions[f9 + 3], by = positions[f9 + 4], bz = positions[f9 + 5];
    const cx = positions[f9 + 6], cy = positions[f9 + 7], cz = positions[f9 + 8];
    const v1x = cx - bx, v1y = cy - by, v1z = cz - bz;
    const v2x = ax - bx, v2y = ay - by, v2z = az - bz;
    const nx = v1y * v2z - v1z * v2y;
    const ny = v1z * v2x - v1x * v2z;
    const nz = v1x * v2y - v1y * v2x;
    const invLength = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
    faceNormals[3 * f + 0] = nx * invLength;
    faceNormals[3 * f + 1] = ny * invLength;
    faceNormals[3 * f + 2] = nz * invLength;
  }
  const vertexIds = new Int32Array(vertexCount);
  const quantized = new Int32Array(vertexCount * 3);
  let tableSize = 1;
  while (tableSize < vertexCount * 2) tableSize <<= 1;
  const tableMask = tableSize - 1;
  const table = new Int32Array(tableSize);
  let uniqueCount = 0;
  for (let i = 0; i < vertexCount; i++) {
    const i3 = 3 * i;
    const qx = ~~(positions[i3 + 0] * hashMultiplier);
    const qy = ~~(positions[i3 + 1] * hashMultiplier);
    const qz = ~~(positions[i3 + 2] * hashMultiplier);
    let slot = (Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791)) & tableMask;
    while (true) {
      const id = table[slot];
      if (id === 0) {
        const q32 = 3 * uniqueCount;
        quantized[q32 + 0] = qx;
        quantized[q32 + 1] = qy;
        quantized[q32 + 2] = qz;
        table[slot] = uniqueCount + 1;
        vertexIds[i] = uniqueCount++;
        break;
      }
      const q3 = 3 * (id - 1);
      if (quantized[q3 + 0] === qx && quantized[q3 + 1] === qy && quantized[q3 + 2] === qz) {
        vertexIds[i] = id - 1;
        break;
      }
      slot = slot + 1 & tableMask;
    }
  }
  const bucketOffsets = new Int32Array(uniqueCount + 1);
  for (let i = 0; i < vertexCount; i++) bucketOffsets[vertexIds[i] + 1]++;
  for (let i = 0; i < uniqueCount; i++) bucketOffsets[i + 1] += bucketOffsets[i];
  const bucketFaces = new Int32Array(vertexCount);
  const bucketCursors = bucketOffsets.slice(0, uniqueCount);
  for (let f = 0; f < faceCount; f++) {
    const f3 = 3 * f;
    bucketFaces[bucketCursors[vertexIds[f3 + 0]]++] = f;
    bucketFaces[bucketCursors[vertexIds[f3 + 1]]++] = f;
    bucketFaces[bucketCursors[vertexIds[f3 + 2]]++] = f;
  }
  const normalArray = new Float32Array(vertexCount * 3);
  for (let f = 0; f < faceCount; f++) {
    const f3 = 3 * f;
    const nx = faceNormals[f3 + 0];
    const ny = faceNormals[f3 + 1];
    const nz = faceNormals[f3 + 2];
    for (let n = 0; n < 3; n++) {
      const i = f3 + n;
      const id = vertexIds[i];
      let sumX = 0, sumY = 0, sumZ = 0;
      for (let k = bucketOffsets[id], end = bucketOffsets[id + 1]; k < end; k++) {
        const o3 = 3 * bucketFaces[k];
        const ox = faceNormals[o3 + 0];
        const oy = faceNormals[o3 + 1];
        const oz = faceNormals[o3 + 2];
        if (nx * ox + ny * oy + nz * oz > creaseDot) {
          sumX += ox;
          sumY += oy;
          sumZ += oz;
        }
      }
      const invLength = 1 / (Math.sqrt(sumX * sumX + sumY * sumY + sumZ * sumZ) || 1);
      normalArray[3 * i + 0] = sumX * invLength;
      normalArray[3 * i + 1] = sumY * invLength;
      normalArray[3 * i + 2] = sumZ * invLength;
    }
  }
  resultGeometry.setAttribute("normal", new BufferAttribute(normalArray, 3, false));
  return resultGeometry;
}
export {
  computeMikkTSpaceTangents,
  computeMorphedAttributes,
  deepCloneAttribute,
  deinterleaveAttribute,
  deinterleaveGeometry,
  estimateBytesUsed,
  interleaveAttributes,
  mergeAttributes,
  mergeGeometries,
  mergeGroups,
  mergeVertices,
  toCreasedNormals,
  toTrianglesDrawMode
};
//# sourceMappingURL=three_examples_jsm_utils_BufferGeometryUtils__js.js.map
