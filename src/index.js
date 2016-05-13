import Permissions from 'auth-perm';
import GraphQLPermissions from 'graphql-permissions';
import RoModel from 'romodel';

import {
  forEach,
  defineClassName,
  defineStatic,
  defineGetterSetter,
  inheritClass,
} from './util';

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
    if (fn.isModel) {
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
      if (fn.isModel) {
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


export default class Model {
  static list = (x) => new FieldType({type: 'list', ofType: x})

  static create(Class, {
    base: Base = Model,
    interfaces = [],
    fields = createCleanObject(),
    rules = {},
  } = {}) {
    const {
      props = {},
      read,
      fields = {},
    } = rules;

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

  static clear() { models = createCleanObject(); }


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
    return this.constructor.interfaces.indexOf(Type) >= 0;
  }
}


const Node = RoModel.create(class Node {
  get nodeType() {
    return this.constructor.name;
  }
}, {
  fields: {
    id: true,
  },
});


function create(Class, {
  ...options,
  rules,
}) {
  const {
    roles = {},
    read,
    fields = {},
  } = rules;


  return RoModel.create(Class, options);
}


const User = RoModel.create(class User {
}, {
  fields: {
    id: true,
  },
});


const Tag = RoModel.create(class Tag {
}, {
  fields: {
    id: true,
  },
});


const InfoInterface = RoModel.create(class InfoInterface {
}, {
  fields: {
    id: true,
  },
  rules: {
    props: {
      isAdmin: function(auth) {
        return auth.isAdmin;
      },
      owner: function(auth) {
        return this.$parentOf('User');
      },
      isOwner: function(auth, props) {
        return props.owner.id === auth.id;
      },
      isPublic: function() {
        return this.$get('isPublic');
      },
      isSharedDirectly: function(auth) {
        return this.$get('sharedTo').includes(auth.id);
      },
      isSharedViaCard: function(auth, props) {
        return Boolean(props.owner.$get('tags').find((tag) =>
          tag.userIds.includes(auth.id) &&
          tag.infoIds.includes(this.id)
        ));
      },
    },
    read: function(auth, props) {
      return props.isAdmin ||
          props.isOwner ||
          props.isPublic ||
          props.isSharedDirectly ||
          props.isSharedViaCard;
    },
    reject: function(auth) {
      return null;
    },
    fields: {
      name: {
        model: 'Model',
        read: function() {
        },
        reject: function() {
        },
      },
      isPublic: {
        read: function(auth, props, parentRead) {
          return (props.isAdmin || props.isOwner) && parentRead();
        },
        reject: function() {
          throw new Error('Cannot access isPublic');
        },
      },
    },
  },
});
