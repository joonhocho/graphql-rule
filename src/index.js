import {
  forEach,
  defineClassName,
  defineStatic,
  defineGetterSetter,
  inheritClass,
} from './util';


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

let models = {};

const getModel = (model) => typeof model === 'string' ? models[model] : model;

const createGetter = (prototype, key, Type) => {
  if (Array.isArray(Type)) {
    // [Model]
    if (key in prototype) {
      const getter = getGetter(prototype, key);
      const FieldModel = Type[0];
      return function get() {
        const {_cache: c} = this;
        return c[key] || (c[key] = this.$createChildren(FieldModel, getter.call(this)));
      };
    }
    const FieldModel = Type[0];
    return function get() {
      const {_cache: c} = this;
      return c[key] || (c[key] = this.$createChildren(FieldModel, this._data[key]));
    };
  }

  if (typeof Type === 'function' || typeof Type === 'string') {
    // Model
    if (key in prototype) {
      const getter = getGetter(prototype, key);
      return function get() {
        const {_cache: c} = this;
        return c[key] || (c[key] = this.$createChild(Type, getter.call(this)));
      };
    }
    return function get() {
      const {_cache: c} = this;
      return c[key] || (c[key] = this.$createChild(Type, this._data[key]));
    };
  }

  if (Type) {
    // Value
    return function get() {
      return this._data[key];
    };
  }
};


export default class Model {
  static create(Class, {
    base: Base = Model,
    interfaces = [],
    fields = {},
  } = {}) {
    const NewModel = class extends Base {};

    const {name} = Class;
    if (models[name]) {
      throw new Error(`'${name}' model already exists!`);
    }
    models[name] = NewModel;

    defineClassName(NewModel, name);
    defineStatic(NewModel, 'isModel', true);
    defineStatic(NewModel, 'fields', fields);
    defineStatic(NewModel, 'interfaces', interfaces);

    [Class, Base].concat(interfaces).forEach((from) =>
        inheritClass(NewModel, from));

    forEach(fields, (type, key) => defineGetterSetter(
      NewModel.prototype, key,
      createGetter(NewModel.prototype, key, type),
      createSetter(key)
    ));

    return NewModel;
  }

  static get = getModel

  static clear() { models = {}; }


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

  $field(name) {
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
    return new (getModel(model))(data, this, this._root, this._context);
  }

  $createChildren(model, dataList) {
    return dataList && dataList.map((data) => this.$createChild(model, data));
  }

  $clearCache(key) {
    if (key) {
      delete this._cache[key];
    } else {
      this._cache = {};
    }
  }

  $implements(Type) {
    return this.constructor.interfaces.indexOf(Type) >= 0;
  }
}
