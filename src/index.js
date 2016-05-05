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

let models = {};

const getModel = (model) => typeof model === 'string' ? models[model] : model;

const createGetter = (key, Type) => {
  if (Array.isArray(Type)) {
    // [Model]
    const FieldModel = Type[0];
    return function get() {
      const {_cache} = this;
      return (key in _cache) ?
        _cache[key] :
        (_cache[key] = this.$createChildren(FieldModel, this._data[key]));
    };
  }

  if (typeof Type === 'function' || typeof Type === 'string') {
    // Model
    return function get() {
      const {_cache} = this;
      return (key in _cache) ?
        _cache[key] :
        (_cache[key] = this.$createChild(Type, this._data[key]));
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
    defineClassName(NewModel, name);
    if (models[name]) {
      throw new Error(`'${name}' model already exists!`);
    }
    models[name] = NewModel;

    defineStatic(NewModel, 'isModel', true);
    defineStatic(NewModel, 'fields', fields);
    defineStatic(NewModel, 'interfaces', interfaces);

    forEach(fields, (type, key) => defineGetterSetter(
      NewModel.prototype, key,
      createGetter(key, type),
      createSetter(key)
    ));

    [Class, Base].concat(interfaces).forEach((from) =>
        inheritClass(NewModel, from));

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
