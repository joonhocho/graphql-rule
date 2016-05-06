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

const createGetter = (prototype, key, FieldType) => {
  if (Array.isArray(FieldType)) {
    // [Model]
    const FieldItemType = FieldType[0];
    if (FieldItemType.isModel || typeof FieldItemType === 'string') {
      if (key in prototype) {
        const getter = getGetter(prototype, key);
        return function get() {
          const {_cache: c} = this;
          return c[key] || (c[key] = this.$createChildren(FieldItemType, getter.call(this)));
        };
      }

      return function get() {
        const {_cache: c} = this;
        return c[key] || (c[key] = this.$createChildren(FieldItemType, this._data[key]));
      };
    }

    if (key in prototype) {
      const getter = getGetter(prototype, key);
      return function get() {
        const list = getter.call(this);
        return list && list.map(FieldItemType);
      };
    }

    return function get() {
      const list = this._data[key];
      return list && list.map(FieldItemType);
    };
  }

  if (FieldType.isModel || typeof FieldType === 'string') {
    // Model
    if (key in prototype) {
      const getter = getGetter(prototype, key);
      return function get() {
        const {_cache: c} = this;
        return c[key] || (c[key] = this.$createChild(FieldType, getter.call(this)));
      };
    }

    return function get() {
      const {_cache: c} = this;
      return c[key] || (c[key] = this.$createChild(FieldType, this._data[key]));
    };
  }

  if (typeof FieldType === 'function') {
    if (key in prototype) {
      const getter = getGetter(prototype, key);
      return function get() {
        return FieldType(getter.call(this));
      };
    }

    return function get() {
      return FieldType(this._data[key]);
    };
  }

  if (FieldType) {
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
