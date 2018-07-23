import {
  forEach,
  fastMap,
  setProperty,
  defineClassName,
  defineStatic,
  defineMethod,
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
let globalDefaultPreRead = true;
let globalDefaultRead = true;
let globalDefaultReadFail = null;
let globalDefaultCache = true;


const getModel = (model) => {
  if (typeof model === 'string') return models[model];
  return model;
};


const createChildModel = (parent, Class, data) =>
  new Class(data, parent._context, parent, parent._root);


const createModelMapFn = (Class) => function(data) {
  return data && createChildModel(this, Class, data);
};


const listRegexp = /\[\s*(.*?)\s*\]/;


const wrapGetterWithModel = ({type, list, readListItem}) => {
  if (!type) return null;

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
      return (obj, key, value) => {
        if (value) {
          const len = value.length;
          const res = [];
          for (let i = 0; i < len; i += 1) {
            const item = value[i];
            const v = mapFn.call(obj, item, i, value);
            if (readListItem(v, obj, key, value)) {
              res.push(v);
            }
          }
          return res;
        }
        return value;
      };
    }

    return (obj, key, value) => value && fastMap(value, mapFn, obj);
  }

  // Non-list type field.
  return (obj, key, value) => mapFn.call(obj, value);
};


const wrapGetterWithReadAccess = ({read, readFail}) => {
  if (read === true) return null;
  if (!read) return readFail;

  if (typeof read !== 'function') {
    throw new Error("'read' must be either a boolean or a function");
  }

  return (obj, key, value) => {
    const canRead = read(obj, key, value);
    if (isPromise(canRead)) {
      return canRead.then((v) => {
        if (v) return value;
        return readFail(obj, key, value);
      });
    }

    if (canRead) return value;
    return readFail(obj, key, value);
  };
};


const wrapGetterWithCache = ({cache = globalDefaultCache}) => {
  if (!cache) return null;

  return (obj, key, value) => {
    setProperty(obj, key, value);
    return value;
  };
};


const mapPromise = (obj, key, val, map) => {
  if (isPromise(val)) {
    return val.then((x) => map(obj, key, x));
  }
  return map(obj, key, val);
};


const createValueMapper = (fn) => (obj, key, value) => mapPromise(obj, key, value, fn);

const createValueReducer = (fns) => (obj, key, value) => {
  let newValue = value;
  const len = fns.length;
  for (let i = 0; i < len; i += 1) {
    newValue = mapPromise(obj, key, newValue, fns[i]);
  }
  return newValue;
};


const createSimpleGetter = (key) => function() {
  return this._data[key];
};

const createSimpleMethod = (key) => function() {
  const data = this._data;
  return data[key](...arguments);
};


const createPromiseWrapper = (key, reducer) => function() {
  const val = this._data[key];
  return mapPromise(this, key, val, reducer);
};

const createPromiseWrapperForMethod = (key, reducer) => function() {
  const data = this._data;
  const val = data[key](...arguments);
  return mapPromise(this, key, val, reducer);
};


const wrapGetterWithPreReadAccess = (key, getter, {preRead, readFail}) => {
  if (preRead === true) return getter;

  if (!preRead) {
    return function() {
      return readFail(this, key);
    };
  }

  if (typeof preRead !== 'function') {
    throw new Error("'preRead' must be either a boolean or a function");
  }

  return function() {
    const canRead = preRead(this, key);
    if (isPromise(canRead)) {
      return canRead.then((v) => {
        if (v) return getter.call(this);
        return readFail(this, key);
      });
    }
    if (canRead) return getter.call(this);
    return readFail(this, key);
  };
};

const wrapMethodWithPreReadAccess = (key, method, {preRead, readFail}) => {
  if (preRead === true) return method;

  if (!preRead) {
    return function() {
      return readFail(this, key);
    };
  }

  if (typeof preRead !== 'function') {
    throw new Error("'preRead' must be either a boolean or a function");
  }

  return function() {
    const canRead = preRead(this, key);
    if (isPromise(canRead)) {
      return canRead.then((v) => {
        if (v) return method.apply(this, arguments);
        return readFail(this, key);
      });
    }

    if (canRead) return method.apply(this, arguments);
    return readFail(this, key);
  };
};


const createGetter = (key, rule) => {
  const fns = [
    wrapGetterWithModel(rule),
    wrapGetterWithReadAccess(rule),
    wrapGetterWithCache(rule),
  ].filter((x) => x);

  let getter;
  if (!fns.length) {
    getter = createSimpleGetter(key);
    getter = wrapGetterWithPreReadAccess(key, getter, rule);
    return getter;
  }

  const reducer = fns.length > 1 ?
    createValueReducer(fns) :
    createValueMapper(fns[0]);

  getter = createPromiseWrapper(key, reducer);
  getter = wrapGetterWithPreReadAccess(key, getter, rule);
  return getter;
};

const createMethod = (key, rule) => {
  const fns = [
    wrapGetterWithModel(rule),
    wrapGetterWithReadAccess(rule),
  ].filter((x) => x);

  let method;
  if (!fns.length) {
    method = createSimpleMethod(key);
    method = wrapMethodWithPreReadAccess(key, method, rule);
    return method;
  }

  const reducer = fns.length > 1 ?
    createValueReducer(fns) :
    createValueMapper(fns[0]);

  method = createPromiseWrapperForMethod(key, reducer);
  method = wrapMethodWithPreReadAccess(key, method, rule);
  return method;
};


// exports

export const config = (defaults) => {
  if ('preRead' in defaults) globalDefaultPreRead = defaults.preRead;
  if ('read' in defaults) globalDefaultRead = defaults.read;
  if ('readFail' in defaults) globalDefaultReadFail = defaults.readFail;
  if ('cache' in defaults) globalDefaultCache = Boolean(defaults.cache);
};

const compileQueue = [];

export const compile = () => {
  const len = compileQueue.length;
  for (let i = 0; i < len; i += 1) {
    compileQueue[i]();
  }
  compileQueue.length = 0;
};


export const create = ({
  name,
  base = Model,
  props = getCleanObject(),
  defaultRule: {
    preRead: defaultPreRead = globalDefaultPreRead,
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
  const compileRule = (rules) => forEach(rules, (rule, key) => {
    const ruleType = typeof rule;
    if (ruleType === 'string' || rule && rule.$signature === SIGNATURE) {
      rule = {
        type: rule,
      };
    } else if (ruleType === 'boolean') {
      rule = {
        preRead: rule,
        read: rule,
      };
    } else if (ruleType === 'function') {
      rule = {
        read: rule,
      };
    } else if (!rule || ruleType !== 'object') {
      rule = null;
    }

    if (!rule) {
      throw new Error(`Invalid rule for ${key}`);
    }

    if (rule.preRead === undefined) rule.preRead = defaultPreRead;
    if (rule.read === undefined) rule.read = defaultRead;
    if (rule.readFail === undefined) rule.readFail = defaultReadFail;
    const {readFail} = rule;
    if (typeof readFail !== 'function') {
      rule.readFail = () => readFail;
    }

    if (rule.method) {
      defineMethod(
        NewModel.prototype,
        key,
        createMethod(key, rule),
      );
    } else {
      defineGetterSetter(
        NewModel.prototype,
        key,
        createGetter(key, rule),
        createSetter(key)
      );
    }
  });

  if (typeof rules === 'function') {
    compileQueue.push(() => compileRule(rules()));
  } else {
    compileRule(rules);
  }

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
    return list && fastMap(list, (data) => createChildModel(this, Class, data));
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
