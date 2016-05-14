import {
  forEach,
  defineClassName,
  defineStatic,
  defineGetterSetter,
  defineLazyProperty,
  inheritClass,
} from './util';

const SIGNATURE = {};

const createCleanObject = () => Object.create(null);

const createSetter = (key) => function set(value) {
  this._data[key] = value;
  delete this._cache[key];
};

const getGetter = (obj, key) => {
  const {get} = Object.getOwnPropertyDescriptor(obj, key);
  if (!get) {
    throw new Error(`Getter must be set for property, '${key}'`);
  }
  return get;
}

let models = createCleanObject();

const getModel = (model) => typeof model === 'string' ? models[model] : model;

const createChildModel = (parent, Class, data) => new Class(data, parent, parent._root, parent._context);

const bypass = (x) => x;
const block = () => undefined;

const normalizeFieldMappingFns = (fns) => {
  return (Array.isArray(fns) ? fns : [fns]).map((fn) => {
    switch (typeof fn) {
    case 'boolean':
      return fn ? bypass : block;
    case 'string':
      return models[fn] || fn;
    case 'function':
      return fn;
    default:
      console.error(fn);
      throw new Error('Invalid field transform function!');
    }
  }).filter((x) => x);
};

const createModelMapFn = (Class) => function(data) {
  return data && createChildModel(this, Class, data);
};

const createGetter = (prototype, key, fieldMappingFns) => {
  if (fieldMappingFns == null) {
    throw new Error('Invalid field transform function!');
  }

  const getter = key in prototype ?
      getGetter(prototype, key) :
      function() { return this._data[key] };

  let fns = fieldMappingFns, isList = false;
  if (fns instanceof FieldType) {
    isList = fns.type === 'list';
    fns = fns.ofType;
  }
  fns = normalizeFieldMappingFns(fns);

  if (!fns.length) {
    // No mapping functions.
    return getter;
  }

  let mapFn;
  if (fns.length === 1) {
    // One mapping function.
    let fn = fns[0];
    if (fn.$signature === SIGNATURE) {
      mapFn = createModelMapFn(fn);
    } else if (typeof fn === 'string') {
      mapFn = function(data) {
        if (!models[fn]) {
          throw new Error(`Unknown field model. model='${fn}'`);
        }
        mapFn = createModelMapFn(models[fn]);
        return mapFn.call(this, data);
      };
    } else {
      mapFn = fn;
    }
  } else {
    // Multiple mapping function.
    fns = fns.map((fn, i) => {
      if (fn.$signature === SIGNATURE) {
        return createModelMapFn(fn);
      }
      if (typeof fn === 'string') {
        return function(data) {
          if (!models[fn]) {
            throw new Error(`Unknown field model. model='${fn}'`);
          }
          fn = fns[i] = createModelMapFn(models[fn]);
          return fn.call(this, data);
        };
      }
      return fn;
    });
    mapFn = function(data) {
      return fns.reduce((x, fn) => fn.call(this, x), data);
    };
  }

  if (isList) {
    // List type field.
    return function get() {
      const {_cache: c} = this;
      if (!(key in c)) {
        const val = getter.call(this);
        c[key] = val && val.map(mapFn, this);
      }
      return c[key];
    };
  } else {
    // Non-list type field.
    return function get() {
      const {_cache: c} = this;
      if (!(key in c)) {
        c[key] = mapFn.call(this, getter.call(this));
      }
      return c[key];
    };
  }
};

class FieldType {
  constructor({type, ofType}) {
    this.type = type;
    this.ofType = ofType;
  }
}


const allowRead = () => true;
const disallowRead = () => false;
const returnNull = () => null;


export const list = (x) => new FieldType({type: 'list', ofType: x});


export const create = ({
  name,
  props = createCleanObject(),
  rules = createCleanObject(),
  interfaces = [],
} = {}) => {
  const NewModel = class extends Model {};

  // name
  if (models[name]) {
    throw new Error(`'${name}' model already exists!`);
  }
  models[name] = NewModel;
  defineClassName(NewModel, name);


  // signature
  defineStatic(NewModel, '$signature', SIGNATURE);


  // interfaces
  defineStatic(NewModel, '$interfaces', interfaces);

  interfaces.forEach((from) =>
      inheritClass(NewModel, from));


  // props
  class Props {
    constructor(model) {
      this.$model = model;
    }
  }

  forEach(props, (fn, key) =>
    defineLazyProperty(Props.prototype, key, function() {
      return fn.call(this, this.$model);
    }));

  defineLazyProperty(NewModel.prototype, '$props', function() {
    return new Props(this);
  }, {
    enumerable: false,
  });


  // rules
  const {
    $default: {
      read: defaultRead = allowRead,
      reject: defaultReject = returnNull,
    },
    ...otherRules,
  } = rules;

  forEach(otherRules, (rule, key) => {
    if (rule === true) {
      rule = {
        read: allowRead,
        reject: defaultReject,
      };
    } else if (rule === false) {
      rule = {
        read: disallowRead,
        reject: defaultReject,
      };
    } else if (typeof rule === 'function') {
      rule = {
        read: rule,
        reject: defaultReject,
      };
    }

    defineGetterSetter(
      NewModel.prototype,
      key,
      createGetter(NewModel.prototype, key, rule),
      createSetter(key)
    )
  });

  return NewModel;
};


export const get = getModel;


export const clear = () => { models = createCleanObject(); };


export class Model {
  constructor(data, parent, root, context = null) {
    this._data = data;
    this._parent = parent || null;
    this._root = root || this;
    this._context = context;
    this._cache = {};
  }

  $destroy() {
    delete this._data;
    delete this._parent;
    delete this._context;
    delete this._cache;
  }

  get $data() {
    return this._data;
  }

  $get(name) {
    return this._data[name];
  }

  get $parent() {
    return this._parent;
  }

  get $context() {
    return this._context;
  }

  get $root() {
    return this._root;
  }

  $parentOfType(type) {
    const Model = getModel(type);
    let p = this;
    while (p = p._parent) {
      if (p instanceof Model) {
        return p;
      }
    }
    return null;
  }

  $createChild(model, data) {
    return createChildModel(this, getModel(model), data);
  }

  $createChildren(model, dataList) {
    const Class = getModel(model);
    return dataList && dataList.map((data) => createChildModel(this, Class, data));
  }

  $clearCache(key) {
    if (key) {
      delete this._cache[key];
    } else {
      this._cache = {};
    }
  }

  $implements(Type) {
    return this.constructor.$interfaces.indexOf(Type) >= 0;
  }
}


export default {
  list,
  create,
  get,
  clear,
  Model,
};
