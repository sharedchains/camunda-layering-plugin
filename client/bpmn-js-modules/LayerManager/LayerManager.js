import { is } from 'bpmn-js/lib/util/ModelUtil';

import { DataElements } from './LayerElements';

import { remove } from 'lodash';

export default function LayerManager(eventBus) {
  this.layers = {
    control: [], // element ids
    data: [], // element ids
    pools: []

    /* hierarchy structure : {
        id: poolId,
        process: processId,
        refs: [] element ids,
        lanes: [] lane ids => element ids
    } */
  };

  let self = this;

  function addLayerElement(element) {
    let isDataElement = DataElements.some(elementType => {
      return is(element, elementType);
    });
    if (isDataElement) {
      self.layers.data.push(element.id);
    } else {
      self.layers.control.push(element.id);
    }

    // TODO: pools hierarchy
  }

  function removeLayerElement(element) {
    remove(self.layers.data, id => id === element.id);
    remove(self.layers.control, id => id === element.id);

    // TODO: pools hierarchy
  }

  eventBus.on(['shape.added', 'connection.added'], context => {
    let element = context.element;
    addLayerElement(element);
  });
  eventBus.on(['shape.removed', 'connection.removed'], context => {
    let element = context.element;
    removeLayerElement(element);
  });
  eventBus.on('commandStack.lane.updateRefs.postExecute', context => {

    // TODO: Check if this command could be useful to handle lanes (and its elements)
  });

}

LayerManager.$inject = ['eventBus'];

LayerManager.prototype.getElements = function(type) {
  let typeToHide;
  switch (type) {
  case 'control':
    typeToHide = 'data';
    break;
  case 'data' :
    typeToHide = 'control';
    break;
  default:
    typeToHide = 'global';
  }

  return this.layers[typeToHide];
};