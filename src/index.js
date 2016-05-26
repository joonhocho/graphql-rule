import {
  forEach,
  setProperty,
  defineClassName,
  defineStatic,
  defineGetterSetter,
  defineLazyProperty,
  inheritClass,
  getCleanObject,
  isPromise,
} from './util';


const SIGNATURE = {};

const createSetter = (key) => function set(value) {
  this._data[key] = value;
  // Removes cache
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


const createSimpleGetter = (key) => function() {
  return this._data[key];
};


const listRegexp = /\[\s*(.*?)\s*\]/;


const wrapGetterWithModel = ({type, list, readListItem}) => {
  if (!type) {
    return null;
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
    if (readListItem) {
      return (obj, key, value) =>
        value && value.map(mapFn, obj).filter(
          (item) => readListItem(item, obj, key, value)
        );
    }

    return (obj, key, value) => value && value.map(mapFn, obj);
  }

  // Non-list type field.
  return (obj, key, value) => mapFn.call(obj, value);
};


const wrapGetterWithAccess = ({read, readFail}) => {
  if (read === true) {
    return null;
  }

  if (!read) {
    if (typeof readFail === 'function') {
      return readFail;
    }
    return () => readFail;
  }

  if (typeof readFail === 'function') {
    return (obj, key, value) => {
      if (read(obj, key, value)) {
        return value;
      }
      return readFail(obj, key, value);
    };
  }

  return (obj, key, value) => {
    if (read(obj, key, value)) {
      return value;
    }
    return readFail;
  };
};


const mapValueWithCache = ({cache = globalDefaultCache}) => {
  if (!cache) {
    return null;
  }

  return (obj, key, value) => {
    obj[key] = value;
    setProperty(obj, key, value);
    return value;
  };
};


const cerateValueMapper = (fn, key) => (obj, value) => fn(obj, key, value);


const createValueReducer = (fns, key) => (obj, value) => fns.reduce(
  (lastValue, fn) => fn(obj, key, lastValue),
  value
);


const createPromiseWrapper = (key, reducer, promise) => promise ?
  function() {
    const p = this._data[key];
    if (isPromise(p)) {
      return p.then((val) => reducer(this, val));
    }
    return reducer(this, p);
  } :
  function() {
    return reducer(this, this._data[key]);
  };


const createNonPromiseWrapper = (key, reducer) => function() {
  const p = this._data[key];
  if (isPromise(p)) {
    return p.then((val) => reducer(this, val));
  }
  return reducer(this, p);
};


const createGetter = (prototype, key, rule) => {
  const fns = [
    wrapGetterWithModel(rule),
    wrapGetterWithAccess(rule),
    mapValueWithCache(rule),
  ].filter((x) => x);

  if (!fns.length) {
    return createSimpleGetter(key);
  }

  const reducer = fns.length > 1 ?
    createValueReducer(fns, key) :
    cerateValueMapper(fns[0], key);

  return createPromiseWrapper(key, reducer, rule.promise);
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
  defaultRule: {
    read: defaultRead = globalDefaultRead,
    readFail: defaultReadFail = globalDefaultReadFail,
  } = {},
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
  forEach(rules, (rule, key) => {
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
