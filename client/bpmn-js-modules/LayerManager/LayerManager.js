import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';

import { CollaborationElements, DataElements } from './LayerElements';

import { filter, find, flatMap, map, remove } from 'lodash';

import { add as collectionAdd } from 'diagram-js/lib/util/Collections';
import { UPDATE_RESOURCES } from '../util/EventHelper';

const LOW_PRIORITY = 100;

export default function LayerManager(eventBus) {
  this.layers = {
    control: [], // element ids
    data: [], // element ids
    pools: []

    /* hierarchy structure : {
        id: poolId,
        name: name,
        process: processId,
        elements: [] element ids,
        lanes: [] lane ids => element ids
    } */
  };

  let self = this;

  function getProcess(element) {
    let businessObject = getBusinessObject(element);

    if (is(businessObject, 'bpmn:Participant')) {
      return businessObject.processRef;
    }
    if (is(businessObject, 'bpmn:Process')) {
      return businessObject;
    }
    if (is(businessObject, 'bpmn:MessageFlow')) {
      return undefined;
    }

    let parent = businessObject;
    while (parent.$parent && !is(parent, 'bpmn:Process')) {
      parent = parent.$parent;
    }

    if (!is(parent, 'bpmn:Process')) {
      return undefined;
    }
    return parent;
  }

  function addLayerElement(element) {
    let isDataElement = DataElements.some(elementType => {
      return is(element, elementType);
    });
    let isCollaborationElement = CollaborationElements.some(elementType => {
      return is(element, elementType);
    });
    let isParticipant = is(element, 'bpmn:Participant');

    if (isDataElement) {
      collectionAdd(self.layers.data, element.id);
    } else if (isCollaborationElement) {
      if (isParticipant) {
        let bo = getBusinessObject(element);
        collectionAdd(self.layers.pools, {
          id: element.id,
          name: bo.get('name'),
          process: bo.get('processRef') ? bo.get('processRef').id : undefined,
          elements: [],
          lanes: []
        });
      }

      // if is a lane, do nothing here
    } else {
      collectionAdd(self.layers.control, element.id);
    }

    let isCollaboration = self.layers.pools.length > 0;
    if (isCollaboration && !isParticipant) {
      let rootElement = getProcess(element);
      if (rootElement) {
        let pool = find(self.layers.pools, { process: rootElement.id });
        if (pool) {
          if (is(element, 'bpmn:Lane')) {
            let lane = {};
            let bo = getBusinessObject(element);
            lane[element.id] = bo.flowNodeRef && bo.flowNodeRef.map(flowNode => flowNode.id) || [];
            collectionAdd(pool.lanes, lane);
          } else {
            collectionAdd(pool.elements, element.id);
          }
        }
      }
    }
  }

  function updateLayerPools(element, additions, removals) {
    removals.forEach(oldLane => {
      let lane = find(
        flatMap(self.layers.pools, 'lanes'),
        poolLane => {
          let [laneId] = Object.entries(poolLane)[0];
          return oldLane.id === laneId;
        });
      if (lane) {
        let [laneId, elementsArray] = Object.entries(lane)[0];
        lane[laneId] = filter(elementsArray, id => id !== element.id);
      }
    });
    additions.forEach(newLane => {
      let lane = find(
        flatMap(self.layers.pools, 'lanes'),
        poolLane => {
          let [laneId] = Object.entries(poolLane)[0];
          return newLane.id === laneId;
        });
      if (lane) {
        let [laneId] = Object.entries(lane)[0];
        collectionAdd(lane[laneId], element.id);
      }

    });
  }

  function removeLayerElement(element) {
    remove(self.layers.data, id => id === element.id);
    remove(self.layers.control, id => id === element.id);

    let isCollaboration = self.layers.pools.length > 0;
    if (isCollaboration) {
      if (is(element, 'bpmn:Participant')) {

        // Remove only the pool, the inner elements where already removed before
        remove(self.layers.pools, pool => pool.id === element.id);
      } else if (is(element, 'bpmn:Lane')) {

        // Remove only the lane, which is only logical
        let process = getProcess(element);
        let pool = find(self.layers.pools, { process: process.id });
        remove(pool.lanes, lane => {
          let [laneId] = Object.entries(lane)[0];
          return laneId === element.id;
        });
      } else {
        let rootElement = getProcess(element);
        if (rootElement) {

          // Remove a single element from the pool hierarchy and, if present, from lanes
          let pool = find(self.layers.pools, { process: rootElement.id });
          remove(pool.elements, id => id === element.id);
          if (pool.lanes.length > 0) {
            let occurredLane = find(pool.lanes, lane => {
              let [, elementsArray] = Object.entries(lane)[0];
              return elementsArray.indexOf(element.id) !== -1;
            });

            if (occurredLane) {
              let [laneId, elementsArray] = Object.entries(occurredLane)[0];
              occurredLane[laneId] = filter(elementsArray, id => id !== element.id);
            }
          }
        }
      }
    }
  }

  eventBus.on(['shape.added', 'connection.added', 'commandStack.shape.create.postExecuted'], LOW_PRIORITY, context => {
    let element = context.element || context.context.shape;
    addLayerElement(element);
  });
  eventBus.on(['shape.removed', 'connection.removed'], LOW_PRIORITY, context => {
    let element = context.element;
    removeLayerElement(element);
  });

  eventBus.on(['commandStack.element.updateProperties.postExecuted'], LOW_PRIORITY, context => {

    // If any element is updated (on id/name), I have to update my layers
    let updatedPropertiesObject = context.context.properties;
    let element = context.context.element;

    let isCollaboration = self.layers.pools.length > 0;
    let isNameUpdated = undefined;
    if (Object.prototype.hasOwnProperty.call(updatedPropertiesObject, 'id') || (is(element, 'bpmn:Participant') && (isNameUpdated = Object.prototype.hasOwnProperty.call(updatedPropertiesObject, 'name')))) {

      let isDataElement = DataElements.some(elementType => {
        return is(element, elementType);
      });
      let isCollaborationElement = CollaborationElements.some(elementType => {
        return is(element, elementType);
      });
      let oldProperties = context.context.oldProperties;

      let oldId = oldProperties.id;
      if (oldId) {
        let newId = updatedPropertiesObject.id;
        let indexElement;
        if (isDataElement) {
          indexElement = self.layers.data.indexOf(oldId);
          self.layers.data.splice(indexElement, 1, newId);
        } else {
          indexElement = self.layers.control.indexOf(oldId);
          if (indexElement !== -1) {
            self.layers.control.splice(indexElement, 1, newId);
          } else if (is(element, 'bpmn:Participant')) {
            let pool = find(self.layers.pools, { id: oldId });
            pool.id = newId;
          } else if (is(element, 'bpmn:Lane')) {
            let process = getProcess(element);
            let pool = find(self.layers.pools, { process: process.id });
            let poolLane = find(pool.lanes, lane => {
              let [laneId] = Object.entries(lane)[0];
              return laneId === oldId;
            });
            Object.defineProperty(poolLane, newId, Object.getOwnPropertyDescriptor(poolLane, oldId));
            delete poolLane[oldId];
          }
        }

        if (isCollaboration && !isCollaborationElement) {

          let rootElement = getProcess(element);
          if (rootElement) {

            // Update a single element from the pool hierarchy and, if present, from lanes
            let pool = find(self.layers.pools, { process: rootElement.id });
            indexElement = pool.elements.indexOf(oldId);
            pool.elements.splice(indexElement, 1, newId);

            if (pool.lanes.length > 0) {
              let occurredLane = find(pool.lanes, lane => {
                let [, elementsArray] = Object.entries(lane)[0];
                return elementsArray.indexOf(element.id) !== -1;
              });

              if (occurredLane) {
                let [, elementsArray] = Object.entries(occurredLane)[0];
                indexElement = elementsArray.indexOf(oldId);
                elementsArray.splice(indexElement, 1, newId);
              }
            }
          }
        }
      }

      if (is(element, 'bpmn:Participant') && isNameUpdated) {
        let pool = find(self.layers.pools, { id: element.id });
        pool.name = updatedPropertiesObject.name;
      }

      // Update perspective layout
      if (isCollaboration) {
        eventBus.fire(UPDATE_RESOURCES);
      }
    }
  });

  eventBus.on('commandStack.lane.updateRefs.postExecute', LOW_PRIORITY, context => {
    let ctx = context.context.updates;
    ctx.forEach(update => {
      let element = update.flowNode;
      if (update.add.length > 0 || update.remove.length > 0) {
        updateLayerPools(element, update.add, update.remove);
      }
    });
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

LayerManager.prototype.getResources = function() {
  return map(this.layers.pools, pool => {
    let lanes = map(pool.lanes, lane => {
      let [laneId] = Object.entries(lane)[0];
      return laneId;
    });
    return { id: pool.id, name: pool.name || pool.id, lanes: lanes };
  });
};