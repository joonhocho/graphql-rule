import {
  forEach,
  setProperty,
  defineClassName,
  defineStatic,
  defineGetterSetter,
  defineLazyProperty,
  inheritClass,
} from './util';


const SIGNATURE = {};

const getCleanObject = () => Object.create(null);

const createSetter = (key) => function set(value) {
  this._data[key] = value;
  delete this[key];
};


let models = getCleanObject();
let globalDefaultRead = true;
let globalDefaultReadFail = null;
let globalDefaultCache = true;


const getModel = (model) =>
  typeof model === 'string' ? models[model] : model;

const createChildModel = (parent, Class, data) =>
  new Class(data, parent._context, parent, parent._root);

const createModelMapFn = (Class) => function(data) {
  return data && createChildModel(this, Class, data);
};

const createSimpleGetter = (key) => function() { return this._data[key]; };

const listRegexp = /\[\s*(.*?)\s*\]/;

const wrapGetterWithModel = (key, getter, {type, list, readListItem}) => {
  if (!type) {
    return getter;
  }

  let mapFn;
  if (typeof type === 'string') {
    const listMatch = type.match(listRegexp);
    if (listMatch) {
      list = true;
      type = listMatch[1];
    }

    mapFn = function(data) {
      if (!models[type]) {
        throw new Error(`Unknown field model. model='${type}'`);
      }
      mapFn = createModelMapFn(models[type]);
      return mapFn.call(this, data);
    };
  } else {
    mapFn = createModelMapFn(type);
  }

  if (list) {
    // List type field.
    if (readListItem) {
      // filter item
      return function get() {
        const val = getter.call(this);
        return val && val.map(mapFn, this).filter(readListItem, this);
      };
    }

    return function get() {
      const val = getter.call(this);
      return val && val.map(mapFn, this);
    };
  }

  // Non-list type field.
  return function get() {
    return mapFn.call(this, getter.call(this));
  };
};

const wrapGetterWithAccess = (key, getter, {read, readFail}) => {
  if (read === true) {
    return getter;
  }

  if (!read) {
    if (typeof readFail === 'function') {
      return function get() {
        return readFail(this, key);
      };
    }
    return function get() { return readFail; };
  }

  if (typeof readFail === 'function') {
    return function get() {
      if (read(this, key)) {
        return getter.call(this);
      }
      return readFail(this, key);
    };
  }

  return function get() {
    if (read(this, key)) {
      return getter.call(this);
    }
    return readFail;
  };
};

const wrapGetterWithCache = (key, getter, {cache = globalDefaultCache}) => {
  if (!cache) {
    return getter;
  }

  return function get() {
    const value = getter.call(this);
    this[key] = value;
    setProperty(this, key, value);
    return value;
  };
};

const createGetter = (prototype, key, rule) => {
  let getter;
  getter = createSimpleGetter(key);
  getter = wrapGetterWithModel(key, getter, rule);
  getter = wrapGetterWithAccess(key, getter, rule);
  getter = wrapGetterWithCache(key, getter, rule);
  return getter;
};


// exports

export const config = (defaults) => {
  if ('read' in defaults) globalDefaultRead = defaults.read;
  if ('readFail' in defaults) globalDefaultReadFail = defaults.readFail;
  if ('cache' in defaults) globalDefaultCache = Boolean(defaults.cache);
};


export const create = ({
  name,
  base = Model,
  props = getCleanObject(),
  rules = getCleanObject(),
  interfaces = [],
} = {}) => {
  const NewModel = class extends base {};

  // name
  if (models[name]) {
    throw new Error(`'${name}' model already exists!`);
  }
  models[name] = NewModel;
  defineClassName(NewModel, name);


  // signature
  defineStatic(NewModel, '$signature', SIGNATURE);


  // props
  class Props {
    constructor(model) {
      this.$model = model;
    }
  }

  defineStatic(NewModel, '$Props', Props);

  forEach(props, (fn, key) =>
    defineLazyProperty(Props.prototype, key, function() {
      return fn.call(this, this.$model);
    }));

  defineLazyProperty(NewModel.prototype, '$props', function() {
    return new Props(this);
  });


  // interfaces
  defineStatic(NewModel, '$interfaces', interfaces);

  if (base !== Model) {
    inheritClass(NewModel, base);
    if (base.$Props) inheritClass(Props, base.$Props);
  }

  interfaces.forEach((from) => {
    inheritClass(NewModel, from);
    if (from.$Props) inheritClass(Props, from.$Props);
  });


  // rules
  const {
    $default: {
      read: defaultRead = globalDefaultRead,
      readFail: defaultReadFail = globalDefaultReadFail,
    } = {},
    ...otherRules,
  } = rules;

  forEach(otherRules, (rule, key) => {
    if (rule === true) {
      rule = {
        read: true,
        readFail: defaultReadFail,
      };
    } else if (rule === false) {
      rule = {
        read: false,
        readFail: defaultReadFail,
      };
    } else if (typeof rule === 'function') {
      rule = {
        read: rule,
        readFail: defaultReadFail,
      };
    } else {
      if (rule.read === undefined) rule.read = defaultRead;
      if (rule.readFail === undefined) rule.readFail = defaultReadFail;
    }

    defineGetterSetter(
      NewModel.prototype,
      key,
      createGetter(NewModel.prototype, key, rule),
      createSetter(key)
    );
  });

  return NewModel;
};


export const get = getModel;


export const clear = () => { models = getCleanObject(); };


export class Model {
  constructor(data, context, parent, root) {
    this._data = data;
    this._parent = parent || null;
    this._root = root || this;
    this._context = context;
  }

  $destroy() {
    delete this._data;
    delete this._parent;
    delete this._context;
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

  $createChildren(model, list) {
    const Class = getModel(model);
    return list && list.map((data) => createChildModel(this, Class, data));
  }

  $implements(Type) {
    return this.constructor.$interfaces.indexOf(Type) >= 0;
  }
}


export default {
  config,
  create,
  get,
  clear,
  Model,
};
