import {
  defineClassName,
  defineStatic,
  defineGetterSetter,
  inheritClass,
} from './util';


const createSetter = (key) => function set(value) {
  this._raw[key] = value;
  delete this._cached[key];
};

let models = {};

const getModel = (model) => typeof model === 'string' ? models[model] : model;

const createGetter = (key, Type) => {
  if (Array.isArray(Type)) {
    // [Model]
    const [FieldModel] = Type;
    return function get() {
      if (key in this._cached) {
        return this._cached[key];
      }
      const instances = this.createChildren(FieldModel, this._raw[key]);
      this._cached[key] = instances;
      return instances;
    };
  }

  if (typeof Type === 'function' || typeof Type === 'string') {
    // Model
    return function get() {
      if (key in this._cached) {
        return this._cached[key];
      }
      const instance = this.createChild(Type, this._raw[key]);
      this._cached[key] = instance;
      return instance;
    };
  }

  if (Type) {
    // value
    return function get() {
      return this._raw[key];
    };
  }
};


export default class Model {
  static create(Class, {
    base = Model,
    interfaces = [],
    fields = {},
    parentAccess = true,
  } = {}) {

    let NewModel;
    if (parentAccess) {
      NewModel = class extends base {
        constructor(data, parent, context) {
          super(data, parent, context);
        }
      };
    } else {
      NewModel = class extends base {
        constructor(data, parent, context) {
          super(data, null, context);
        }
      };
    }

    const {name} = Class;
    defineClassName(NewModel, name);
    if (models[name]) {
      throw new Error(`'${name}' model already exists!`);
    }
    models[name] = NewModel;

    defineStatic(NewModel, 'isModel', true);
    defineStatic(NewModel, 'fields', fields);
    defineStatic(NewModel, 'interfaces', interfaces);

    Object.keys(fields).forEach((key) => defineGetterSetter(
      NewModel.prototype, key,
      createGetter(key, fields[key]),
      createSetter(key)
    ));

    inheritClass(NewModel, Class);
    inheritClass(NewModel, base);
    interfaces.forEach((itfc) => inheritClass(NewModel, itfc));

    return NewModel;
  }

  static get = getModel
  static clear() { models = {}; }

  constructor(data, parent = null, context = null) {
    this._raw = data;
    this._parent = parent;
    this._context = context;
    this._cached = {};
  }

  destroy() {
    delete this._raw;
    delete this._parent;
    delete this._context;
    delete this._cached;
  }

  getRawData() {
    return this._raw;
  }

  setRawData(data) {
    return this._raw = data;
  }

  getRawValue(name) {
    return this._raw[name];
  }

  getParent() {
    return this._parent;
  }

  getContext() {
    return this._context;
  }

  getParentOfType(Type) {
    if (!Type.isModel) {
      Type = models[Type];
    }
    let p = this;
    while (p = p._parent) {
      if (p instanceof Type) {
        return p;
      }
    }
    return null;
  }

  createChild(model, data) {
    return new (getModel(model))(data, this, this._context);
  }

  createChildren(model, dataList) {
    return dataList && dataList.map((data) => this.createChild(model, data));
  }

  clearCache(key) {
    if (key) {
      delete this._cached[key];
    } else {
      this._cached = {};
    }
  }

  implements(Type) {
    return this.constructor.interfaces.indexOf(Type) >= 0;
  }
}
