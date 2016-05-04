import {
  inheritClass,
} from './util';

export default class Model {
  static createClass({

    interfaces = [],
  }) {
    const NewModel = class extends Base {

    }

    return NewModel;
  }

  constructor(data) {
    this._data = data;
  }

  get parent() {
  }
}

{
  profile {
    id
    profileInfo {
      names [{
        id
        firstName
        lastName
        name
      }]
      name
    }
  }
}

Model.create(
  class ProfileInfoName extends ProfileInfoBase {
    constructor(data) {
      super(data);
    }

    // id inherited from node

    // isPublic inherited from ProfileInfoInterface

    get shortName() {
      return this.firstName + ' ' + this.lastName;
    }
  },
  interfaces: [Node, ProfileInfoInterface],
)
