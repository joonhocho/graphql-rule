# graphql-rule
Unopinionated rule based access / authorization / permission control for GraphQL type fields.

Inspired by [RoModel](https://github.com/joonhocho/romodel) and Firebase rules.

It actually has no dependencies to GraphQL. You can use it for any rule-base access control!



### Install
```
npm install --save graphql-rule
```


### How It Works
You define access `rules` for each property of your data (object), and it will
allow or disallow read to the property based on the predefined rules.
(only read rules are supported for now).

It is designed for access control in GraphQL, but it is not opinionated nor requires any dependencies.
Thus, it can be used for all projects with or without GraphQL.


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

const User = Rule.create({
  name: 'User',

  // props are lazily initialized and cached once initialized.
  // accessible via `model.$props`.
  props: {
    isAdmin: (model) => model.$context.admin,

    isAuthenticated: (model) => Boolean(model.$context.userId),

    isOwner: (model) => model.$data.id === model.$context.userId,
  },

  rules: {
    id: true,

    email: {
      // allow access by admin or owner.
      read: (model) => model.$props.isAdmin || model.$props.isOwner,

      // returns null when read denied.
      readFail: null,
    },

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

const Profile = Rule.create({
  name: 'Profile',

  rules: {
    name: true,

    phone: {
      // Access `User` model via `$parent`.
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
const user = new User(userData, session);

user.id // 'user_id'

user.email // `null` since not admin nor owner.

user.password // throws Error('Access denied').

user.profile // `Profile` instance. accessible since authenticated.

user.profile.name // 'John Doe'

user.profile.phone // throws Error('Not authorized!') since not admin nor owner.
```


### Integration with GraphQL
```javascript
// Use `User` and `Profile` from the above example.

var profileType = new GraphQLObjectType({
  name: 'Profile',
  fields: {
    name: { type: GraphQLString },
    phone: { type: GraphQLString },
  }
});

var userType = new GraphQLObjectType({
  name: 'User',
  fields: {
    id: { type: GraphQLString },
    email: { type: GraphQLString },
    password: { type: GraphQLString },
    profile: { type: profileType },
  }
});

var schema = new graphql.GraphQLSchema({
  query: new graphql.GraphQLObjectType({
    name: 'Query',
    fields: {
      user: {
        type: userType,
        args: {
          id: { type: graphql.GraphQLString }
        },
        resolve: function (_, args, session) {
          return new User(userDatabase[args.id], session);
        }
      }
    }
  })
});

app.use('/graphql', graphqlHTTP((request) => ({
  schema: schema,
  context: request.session,
})));
```


### More $props / $context
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


### Advanced Usage
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
