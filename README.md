# graphql-rule
Rule based access / authorization / permission control for GraphQL type fields.
Inspired by [RoModel](https://github.com/joonhocho/romodel) and Firebase rules.

### Install
```
npm install --save graphql-rule
```

### Basic Usage
```javascript
import {create} from 'graphql-rule';

const Model = create({
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
  rules: {
    $default: {
      // read allowed by default
      read: (model) => true,
      
      // throws an error when read not allowed
      readFail: (model, key) => { throw new Error(`Cannot access '${key}'`); },
    },
    
    // use $default settings
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

// allowed to read by $default.read rule
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
