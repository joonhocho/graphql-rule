# graphql-rule
[![Build Status](https://travis-ci.org/joonhocho/graphql-rule.svg?branch=master)](https://travis-ci.org/joonhocho/graphql-rule)
[![Coverage Status](https://coveralls.io/repos/github/joonhocho/graphql-rule/badge.svg?branch=master)](https://coveralls.io/github/joonhocho/graphql-rule?branch=master)
[![npm version](https://badge.fury.io/js/graphql-rule.svg)](https://badge.fury.io/js/graphql-rule)
[![Dependency Status](https://david-dm.org/joonhocho/graphql-rule.svg)](https://david-dm.org/joonhocho/graphql-rule)
[![License](http://img.shields.io/:license-mit-blue.svg)](http://doge.mit-license.org)

Unopinionated rule based access / authorization / permission control for GraphQL type fields.

Inspired by [RoModel](https://github.com/joonhocho/romodel) and Firebase rules.

It actually has no dependencies to GraphQL. You can use it with plain js objects!

Supports Node.js >= 4.0.



### Install
```
npm install --save graphql-rule
```


### How It Works
`graphql-rule` is simply an authorization layer between your data and data accessor (`resolve` functions in GraphQL).


    Without `graphql-rule`:
    +-------------+           +------------+
    |             |           |            |
    |             |           |            |
    |  Accessor   |   +--->   |    Data    |
    |  (GraphQL)  |           |            |
    |             |           |            |
    |             |           |            |
    +-------------+           +------------+


    With `graphql-rule`:
    +-------------+           +------------+           +------------+
    |             |           |            |           |            |
    |             |           |            |           |            |
    |  Accessor   |   +--->   |   Rules    |   +--->   |    Data    |
    |  (GraphQL)  |           |            |           |            |
    |             |           |            |           |            |
    |             |           |            |           |            |
    +-------------+           +------------+           +------------+


You define access `rules` for each property of your data (object), and it will
allow or disallow read to the property based on the predefined rules.
(only read rules are supported for now).

It is designed for access control in GraphQL, but it is not opinionated nor requires any dependencies.
Thus, it can be used for all projects with or without GraphQL.



### API - Rule.create(options)
```javascript
import Rule from 'graphql-rule';

Rule.create({
  // [REQUIRED] Unique rule model name.
  // Used for child field type specification.
  name: string = null,
  
  // Base class for newly created and returned rule model class.
  // Base class must extend {Model} from 'graphql-rule'.
  base: ?class = class<Model>,
  
  // Define dynamic property getters.
  // Can be accessed via `model.$props.propName`
  // Each property is lazily initialized upon the first access and cached for performance.
  // Useful for something expensive to calculate and is accessed over and over by multiple fields.
  props: {
    [propName: string]: (model: Model) => any,
  } = {},
  
  // Define default rule for fields in this model.
  defaultRule: {
    // `preRead` is checked before accessing or calling a field.
    // Useful for failing fast before accessing field that can be expensive to calculate such as field that initiates network calls
    // If `false` or `preRead(model, key)` returns falsy value, the access to field will fail immediately.
    // [default=true]
    preRead: boolean | (model: Model, key: string) => boolean | Promise<boolean>,
    
    // `read` is checked after accessing or calling a field.
    // Useful for passing/failing based on the field value.
    // If `false` or `read(model, key, value)` returns falsy value, the access to field will fail immediately.
    // [default=true]
    read: boolean | (model: Model, key: string, value: any) => boolean | Promise<boolean>,
    
    // `readFail` is used when either `preRead` or `read` returns falsy value.
    // If it is not a function, it is used as a final value for the failed field.
    // If it is function, the returend value is used as a final value for the failed field.
    // It can throw an error, if throwing an error is a desired upon unauthorized access to a field.
    // [default=null]
    readFail: any | (model: Model, key: string, value: ?any) => any,
  } = {preRead: true, read: true, readFail: null},
  
  // Define access rule for fields in this model.
  rules: {
    [fieldName: string]: {
      // See `defaultRule.preRead`
      preRead,
      
      // See `defaultRule.read`
      read,
      
      // See `defaultRule.readFail`
      readFail,
      
      // If specified, field value will be wrapped as an instance of the specified Model class.
      type: string | class<Model> = null,
      
      // Whether the field returns a list of Model instances.
      // Used together with `type` above.
      list: boolean = false,
      
      // Filter function for list.
      // Used together with `list` above.
      readListItem: (listItem: FieldModel, model: Model, key: string, list: [FieldModel]) => boolean
      
      // Whether the field is a function method.
      method: boolean = false,
      
      // Whether to cached the final value for the field.
      // Only applied if `method: false` above.
      cache: boolean = true,
    },
  },
  
  // Interfaces to inherit static and prototype properties and methods from.
  // Useful if you have common props / field rules / etc.
  interfaces: [class<Model>] = [],
})
```


### Basic Usage without GraphQL
```javascript
import Rule from 'graphql-rule';

// create access control model for your data
const Model = Rule.create({
  // name for this access model
  name: 'Model',

  // define access rules
  rules: {
    // allow access to `public` property.
    public: true,

    secret: {
      // disallow access to `secret` property.
      read: false,

      // throw an error when read is disallowed.
      readFail: () => { throw new Error('Access denied'); },
    },

    conditional: {
      // access raw data via `$data`.
      // conditionally allow access if `conditional` <= 3.
      read: (model) => model.$data.conditional <= 3,

      readFail: (model) => { throw new Error(`${model.$data.conditional} > 3`); },
    },
  },
});


// create a wrapped instance of your data.
const securedData = new Model({
  public: 'public data',
  secret: 'something secret',
  conditional: 5,
});

securedData.public // 'public data'

securedData.secret // throws Error('Access denied').

securedData.conditional // throws Error('5 > 3').


// same access model for different data.
const securedData2 = new Model({conditional: 1});

securedData2.conditional // 1 since 1 < 3.
```


### User / Profile with Session
```javascript
// set default `readFail`
Rule.config({
  readFail: () => { throw new Error('Access denied'); },
});

const UserRule = Rule.create({
  name: 'User',

  // props are lazily initialized and cached once initialized.
  // accessible via `model.$props`.
  props: {
    isAdmin: (model) => model.$context.admin,

    isAuthenticated: (model) => Boolean(model.$context.userId),

    isOwner: (model) => model.$data.id === model.$context.userId,
  },

  rules: {
    // Everyone can read `id`.
    id: true,

    email: {
      // allow access by admin or owner.
      read: (model) => model.$props.isAdmin || model.$props.isOwner,

      // returns null when read denied.
      readFail: null,
    },

    // No one can read `password`.
    password: false,

    profile: {
      // Use `Profile` Rule for `profile`.
      type: 'Profile',

      // allow access by all authenticated users
      read: (model) => model.$props.isAuthenticated,

      readFail: () => { throw new Error('Login Required'); },
    },
  },
});

const ProfileRule = Rule.create({
  name: 'Profile',

  rules: {
    name: true,

    phone: {
      // Access `UserRule` instance via `$parent`.
      read: (model) => model.$parent.$props.isAdmin || model.$parent.$props.isOwner,

      readFail: () => { throw new Error('Not authorized!'); },
    },
  },
});


const session = {
  userId: 'session_user_id',
  admin: false,
};

const userData = {
  id: 'user_id',
  email: 'user@example.com',
  password: 'secret',
  profile: {
    name: 'John Doe',
    phone: '123-456-7890',
  },
};

// pass `session` as a second param to make it available as `$context`.
const user = new UserRule(userData, session);

user.id // 'user_id'

user.email // `null` since not admin nor owner.

user.password // throws Error('Access denied').

user.profile // `ProfileRule` instance. accessible since authenticated.

user.profile.name // 'John Doe'

user.profile.phone // throws Error('Not authorized!') since not admin nor owner.
```


### Integration with GraphQL
```javascript
// Use `UserRule` and `ProfileRule` from the above example.

const ProfileType = new GraphQLObjectType({
  name: 'Profile',
  fields: {
    name: { type: GraphQLString },
    phone: { type: GraphQLString },
  }
});

const UserType = new GraphQLObjectType({
  name: 'User',
  fields: {
    id: { type: GraphQLID },
    email: { type: GraphQLString },
    password: { type: GraphQLString },
    profile: { type: ProfileType },
  }
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      user: {
        type: UserType,
        args: {
          id: { type: GraphQLID }
        },
        resolve: (_, args, session) => {
          // `context` is passed as the third parameter of `resolve` function.
          // pass the `context` as the second parameter of `UserRule`.
          // Now your data is secured by predefined rules!
          return database.getUser(args.id).then((user) => new UserRule(user, session));
        },
      }
    }
  })
});

app.use('/graphql', graphqlHTTP((request) => ({
  schema: schema,
  // pass session data as `context`.
  // becomes available as third parameter in field `resolve` functions.
  context: request.session,
})));
```


### Integration with Mongoose & GraphQL
```javascript
// Define Mongoose schemas.
const UserModel = mongoose.model('User', new mongoose.Schema({
  email: String,
  password: String,
  profile: {
    type: ObjectId,
    ref: 'Profile',
  },
}));

const ProfileModel = mongoose.model('Profile', new mongoose.Schema({
  name: String,
  phone: String,
}));


// Define access rules.
const UserRule = Rule.create({
  name: 'User',
  props: {
    isAdmin: (model) => model.$context.admin,
    isOwner: (model) => model.$data.id === model.$context.userId,
  },
  rules: {
    id: true,
    email: {
      preRead: (model) => model.$props.isAdmin || model.$props.isOwner,
      readFail: () => { throw new Error('Unauthorized'); },
    },
    password: false,
    profile: {
      type: 'Profile',
      preRead: true,
    },
  },
});

const ProfileRule = Rule.create({
  name: 'Profile',
  rules: {
    name: true,
    phone: {
      preRead: (model) => model.$parent.$props.isAdmin || model.$parent.$props.isOwner,
      readFail: () => null,
    },
  },
});


// Define GraphQL Types.
const ProfileType = new GraphQLObjectType({
  name: 'Profile',
  fields: {
    name: { type: GraphQLString },
    phone: { type: GraphQLString },
  }
});

const UserType = new GraphQLObjectType({
  name: 'User',
  fields: {
    id: { type: GraphQLID },
    email: { type: GraphQLString },
    password: { type: GraphQLString },
    profile: { type: ProfileType },
  }
});


// Define GraphQL Queries.
const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      user: {
        type: UserType,
        args: {
          id: { type: GraphQLID }
        },
        resolve: async (_, {id}, sessionContext) => {
          const userId = new ObjectId(id);
          const user = await UserModel.findById(userId).populate('profile').exec();
          const securedUser = new UserRule(user, sessionContext);
          return securedUser;
        },
      }
    }
  })
});


// Express GraphQL middleware.
app.use('/graphql', graphqlHTTP((request) => ({
  schema: schema,
  context: request.session,
})));
```


### More $props and $context
```javascript

const Model = Rule.create({
  name: 'Model',
  props: {
    // context.admin
    isAdmin: (model) => Boolean(model.$context.admin),

    // !context.userId
    isGuest: (model) => !model.$context.userId,

    // !props.isGuest
    isAuthenticated: (model) => !model.$props.isGuest,

    // context.userId
    authId: (model) => model.$context.userId,

    // data.authorId
    authorId: (model) => model.$data.authorId,

    // props.authorId === props.authId
    isOwner: (model) => model.$props.authorId === model.$props.authId,
  },
  defaultRule: {
    // read allowed by default
    read: (model) => true,

    // throws an error when read not allowed
    readFail: (model, key) => { throw new Error(`Cannot access '${key}'`); },
  },
  rules: {

    // use defaultRule settings
    authorId: {},

    // read allowed only if `props.isAdmin`
    adminField: (model) => model.$props.isAdmin,

    // above is equivalent to:
    adminField: {
      read: (model) => model.$props.isAdmin,
    },

    // read allowed only if `props.isAuthenticated`
    authField: (model) => model.$props.isAuthenticated,

    // read allowed only if `props.isGuest`
    guestField: (model) => model.$props.isGuest,

    // read allowed only if `props.isOwner`
    ownerField: (model) => model.$props.isOwner,

    notAllowedField: {
      read: (model) => false,
      readFail: (model, key) => { throw new Error('not allowed'); },
    },

    nullField: {
      read: (model) => false,
      readFail: (model) => null,
    },
  },
});

const session = {
  userId: 'user_id_1',
  admin: true,
};

const model = new Model(
  {
    authorId: 'user_id_1',
    adminField: 'adminFieldValue',
    authField: 'authFieldValue',
    guestField: 'guestFieldValue',
    ownerField: 'ownerFieldValue',
    notAllowedField: 'notAllowedFieldValue',
    nullField: 'nullFieldValue',
    undefinedField: 'undefinedFieldValue',
  }, // passed as $data
  session // passed as $context
);

model.$props.isAdmin === true;
model.$props.isGuest === false;
model.$props.isAuthenticated === true;
model.$props.isOwner === true;
model.$props.authId === 'user_id_1';
model.$props.authorId === 'user_id_1';

// allowed to read by defaultRuledefault.read rule
model.authorId === 'user_id_1';

// allowed to read since $props.isAdmin
model.adminField === 'adminFieldValue';

// allowed to read since $props.isAuthenticated
model.authField === 'authFieldValue';

// not allowed to read since !$props.isGuest
model.guestField; // throws Error("Cannot access 'guestField'")

// allowed to read since $props.isOwner
model.ownerField === 'ownerFieldValue';

// not allowed to read
model.notAllowedField; // throws Error('not allowed')

// not allowed to read; returns null
model.nullField === null;

// rule is undefined
model.undefinedField === undefined;
```



### Even More Advanced Usage
Take a look at [test file](https://github.com/joonhocho/graphql-rule/blob/master/test/index.js).


### LICENSE
```
The MIT License (MIT)

Copyright (c) 2016 Joon Ho Cho

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
