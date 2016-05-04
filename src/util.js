export function getOwnPropertyDescriptors(obj) {
  const descs = {};
  Object.getOwnPropertyNames(obj).forEach((name) => {
    descs[name] = Object.getOwnPropertyDescriptor(obj, name);
  });
  return descs;
}

export function inheritPropertyFrom(objA, objB, key, asKey) {
  return Object.defineProperty(
    objA,
    asKey || key,
    Object.getOwnPropertyDescriptor(objB, key)
  );
}

export function inheritFrom(objA, objB, excludes) {
  const aKeys = Object.getOwnPropertyNames(objA);
  const bKeys = Object.getOwnPropertyNames(objB);

  let keys = bKeys.filter((key) => aKeys.indexOf(key) === -1);
  if (excludes) {
    keys = keys.filter((key) => excludes.indexOf(key) === -1);
  }

  keys.forEach((key) => inheritPropertyFrom(objA, objB, key));
  return objA;
}

export function inheritStatic(classA, classB) {
  inheritFrom(classA, classB, ['length', 'name', 'prototype']);
  return classA;
}

export function inheritPrototype(classA, classB) {
  inheritFrom(classA.prototype, classB.prototype, ['constructor']);
  return classA;
}

export function inheritClass(classA, classB) {
  inheritStatic(classA, classB);
  inheritPrototype(classA, classB);
  return classA;
}
