import {
  inheritClass,
} from './util';

const defineStatic = (Class, name, value) => {
  Object.defineProperty(Class, name, {
    value,
    writable: false,
    enumerable: false,
    configurable: true,
  });
};

const defineGetterSetter = (Class, name, get, set) => {
  Object.defineProperty(Class, name, {
    get,
    set,
    enumerable: true,
    configurable: true,
  });
};

export const models = {};

const createSetter = (key) => function set(value) {
  this._raw[key] = value;
  delete this._cached[key];
};

const createGetter = (key, Type) => {
  if (Array.isArray(Type)) {
    // [Model]
    const [FieldModel] = Type;
    return function get() {
      if (key in this._cached) {
        return this._cached[key];
      }
      const list = this._raw[key];
      const instances = list && list.map((item) => new FieldModel(item, this));
      this._cached[key] = instances;
      return instances;
    };
  }

  if (typeof Type === 'function') {
    // Model
    return function get() {
      if (key in this._cached) {
        return this._cached[key];
      }
      const instance = new Type(this._raw[key], this);
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
  } = {}) {
    const NewModel = class extends base {
      constructor(data, parent) {
        super(data, parent);
      }
    };

    defineStatic(NewModel, 'name', Class.name);
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

    if (models[NewModel.name]) {
      throw new Error(`'${NewModel.name}' model already exists!`);
    }
    models[NewModel.name] = NewModel;

    return NewModel;
  }

  constructor(data, parent = null) {
    this._raw = data;
    this._parent = parent;
    this._cached = {};
  }

  getRawData() {
    return this._raw;
  }

  getRawValue(name) {
    return this._raw[name];
  }

  getParent() {
    return this._parent;
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

  implements(Type) {
    return this.constructor.interfaces.indexOf(Type) >= 0;
  }
}
