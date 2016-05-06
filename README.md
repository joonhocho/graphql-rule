# graphql-model
A data model class for wrapping a data object for easier resolving fields in GraphQL.


### Install
```
npm install --save graphql-model
```


### Usage

#### Basic
```javascript
const MyModel = Model.create(class MyModel {
  // define a class method.
  getId() { return this.id; }
}, {
  // declare directly accessible fields
  fields: {
    // declare 'id' field with the default getter.
    id: true,
  },
});


const a = new MyModel({id: 1, foo: 'bar'});


// Accessing 'id' value
a.id === 1; // directly accessible since declared in 'fields'

a.getId() === 1; // access via calling a class method

a.$get('id') === 1; // accessible via pre-defined '$get' method

a.$data.id === 1; // accessible via '$data' method that returns the raw data


// Accessing 'foo' value
a.foo === undefined; // not directly accessible since not declared in 'fields'

a.$get('foo') === 'bar' // accessible via '$get' though not declared

a.$data.foo === 'bar' // or via '$data'
```

#### Class Methods / Getters / Static
```javascript
const Plus = Model.create(class Plus {
  // static
  static plus1(obj) { return obj.value + 1; }

  // method
  plus2() { return this.value + 2; }

  // getter
  get plus3() { return this.value + 3; }
}, {
  fields: {
    value: true,
  },
});

const a = new Plus({value: 4});

Plus.plus1(a) === 5; // static method

a.plus2() === 6; // member method

a.plus3 === 7 // getter
```


#### Class Inheritance
```javascript
const ShapeModel = Model.create(class Shape {
  // a static method
  static isShape(obj) { return obj instanceof ShapeModel; }

  // static property to be overriden
  static classId = 1

  // a method
  getName() { return this.name; }

  // method to be overriden
  getClassName() { return 'Shape'; }
}, {
  fields: {
    name: true,
  },
});

const ShapeWithColorModel = Model.create(class ShapeWithColor {
  // add a static property
  static isShapeWithColor(obj) { return obj instanceof ShapeWithColorModel; }

  // override a static property
  static classId = 2

  // add new method
  getColor() { return this.color; }

  // override a method
  getClassName() { return 'ShapeWithColor'; }
}, {
  base: ShapeModel,
  fields: {
    color: true,
  },
});


const s = new ShapeModel({name: 'box'});

(s instanceof ShapeModel) === true;
(s instanceof ShapeWithColorModel) === false;

// static
ShapeModel.isShape({}) === false;
ShapeModel.isShape(s) === true;
ShapeModel.classId === 1;

s.name === 'box';
s.getName() === 'box';
s.getClassName() === 'Shape';


const c = new ShapeWithColorModel({name: 'red box', color: 'red'});

(c instanceof ShapeModel) === true;
(c instanceof ShapeWithColorModel) === true;

// static
ShapeWithColorModel.isShape({}) === false;
ShapeWithColorModel.isShape(s) === true;
ShapeWithColorModel.isShape(c) === true;
ShapeWithColorModel.isShapeWithColor({}) === false;
ShapeWithColorModel.isShapeWithColor(s) === false;
ShapeWithColorModel.isShapeWithColor(c) === true;
ShapeWithColorModel.classId === 2;

// Inherited field and method
c.name === 'red box';
c.getName() === 'red box';

// Extended field and method
c.color === 'red';
c.getColor() === 'red';

// Method override
c.getClassName() === 'ShapeWithColor';
```


#### Parent / Child
```javascript
const ChildModel = Model.create(class ChildModel {
  getName() { return this.name; }
}, {
  fields: {
    name: true,
  },
});

const ParentModel = Model.create(class ParentModel {
}, {
  fields: {
    // declare 'child' field as 'ChildModel'.
    child: ChildModel,
    children: [ChildModel],
  },
});


const p = new ParentModel({
  child: {name: 'a'},
  children: [{name: 'b'}, {name: 'c'}],
});

(p.child instanceof ChildModel) === true;
(p.children[0] instanceof ChildModel) === true;
(p.children[1] instanceof ChildModel) === true;

p.child.name === 'a';
p.child.getName() === 'a';

p.children[0].name === 'b';
p.children[0].getName() === 'b';
```


#### Advanced



### TODO
 - super.superMethod();


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
